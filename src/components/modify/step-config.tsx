import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction, computed } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as dedent from 'dedent';
import {
    Operation as JsonPatchOperation,
    validate as validateJsonPatch
} from 'fast-json-patch';

import { Headers, RawHeaders } from '../../types';
import { css, styled } from '../../styles';
import { WarningIcon } from '../../icons';
import { uploadFile } from '../../util/ui';
import { asError, isErrorLike, unreachableCheck, UnreachableCheck } from '../../util/error';
import {
    byteLength,
    asBuffer,
    isProbablyUtf8,
    stringToBuffer,
    bufferToString
} from '../../util/buffer';
import { formatDuration } from '../../util/text';
import {
    getHeaderValue,
    headersToRawHeaders,
    rawHeadersToHeaders,
    HEADER_NAME_REGEX,
    setHeaderValue
} from '../../model/http/headers';
import {
    ADVANCED_PATCH_TRANSFORMS,
    serverSupports
} from '../../services/service-versions';

import {
    Step,
    RuleType,
    getRulePartKey,
    AvailableStepKey,
    isHttpCompatibleType,
    MatchReplacePairs
} from '../../model/rules/rules';
import {
    StaticResponseStep,
    ForwardToHostStep,
    PassThroughStep,
    TransformingStep,
    RequestTransform,
    ResponseTransform,
    RequestBreakpointStep,
    ResponseBreakpointStep,
    RequestAndResponseBreakpointStep,
    DelayStep,
    TimeoutStep,
    CloseConnectionStep,
    ResetConnectionStep,
    FromFileResponseStep,
    WebhookStep,
    RequestWebhookEvents
} from '../../model/rules/definitions/http-rule-definitions';
import {
    WebSocketPassThroughStep,
    EchoWebSocketStep,
    RejectWebSocketStep,
    ListenWebSocketStep,
    WebSocketForwardToHostStep
} from '../../model/rules/definitions/websocket-rule-definitions';
import {
    EthereumCallResultStep,
    EthereumNumberResultStep,
    EthereumHashResultStep,
    EthereumReceiptResultStep,
    EthereumBlockResultStep,
    EthereumErrorStep
} from '../../model/rules/definitions/ethereum-rule-definitions';
import {
    IpfsCatTextStep,
    IpfsCatFileStep,
    IpfsAddResultStep,
    IpnsResolveResultStep,
    IpnsPublishResultStep,
    IpfsPinsResultStep,
    IpfsPinLsResultStep
} from '../../model/rules/definitions/ipfs-rule-definitions';
import {
    DynamicProxyStep,
    EchoStep,
    CloseStep,
    WaitForMediaStep,
    WaitForDurationStep,
    WaitForChannelStep,
    WaitForMessageStep,
    CreateChannelStep,
    SendStep
} from '../../model/rules/definitions/rtc-rule-definitions';

import { getStatusMessage } from '../../model/http/http-docs';
import { MethodName, MethodNames } from '../../model/http/methods';
import { NATIVE_ETH_TYPES } from '../../model/rules/definitions/ethereum-abi';
import {
    getDefaultMimeType,
    EditableContentType,
    getEditableContentType
} from '../../model/events/content-types';
import { RulesStore } from '../../model/rules/rules-store';

import { SelfSizedEditor } from '../editor/base-editor';
import { TextInput, Select, Button } from '../common/inputs';
import { EditableHeaders, EditableRawHeaders } from '../common/editable-headers';
import { EditableStatus } from '../common/editable-status';
import { FormatButton } from '../common/format-button';
import { EditablePairs, PairsArray } from '../common/editable-pairs';
import { ContentMonoValue } from '../common/text-content';

type StepConfigProps<H extends Step> = {
    ruleType: RuleType;
    step: H;
    onChange: (step: H) => void;
    onInvalidState: () => void;
};

abstract class StepConfig<
    H extends Step,
    P extends {} = {}
> extends React.Component<StepConfigProps<H> & P> { }

const ConfigContainer = styled.div`
    margin-top: 10px;
    font-size: ${p => p.theme.textSize};
`;

const ConfigExplanation = styled.p`
    font-size: ${p => p.theme.textSize};
    line-height: 1.3;
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-style: italic;
    overflow-wrap: break-word;

    &:not(:first-child) {
        margin-top: 10px;
    }
`;

export function StepConfiguration(props: {
    ruleType: RuleType,
    step: Step,
    onChange: (step: Step) => void,
    onInvalidState?: () => void // Currently unused - intended to improve invalid entry UX later on
}) {
    const { step, onChange, onInvalidState } = props;

    const configProps = {
        ruleType: props.ruleType,
        step: step as any,
        onChange,
        onInvalidState: onInvalidState || _.noop
    };

    const stepKey = getRulePartKey(step) as AvailableStepKey;

    switch (stepKey) {
        case 'simple':
            return <StaticResponseStepConfig {...configProps} />;
        case 'file':
            return <FromFileResponseStepConfig {...configProps} />;
        case 'forward-to-host':
        case 'ws-forward-to-host':
            return <ForwardToHostStepConfig
                {...configProps}
                stepKey={stepKey}
            />;
        case 'passthrough':
        case 'ws-passthrough':
            return <PassThroughStepConfig {...configProps} />;
        case 'req-res-transformer':
            return <TransformingStepConfig {...configProps} />;
        case 'request-breakpoint':
            return <RequestBreakpointStepConfig {...configProps} />;
        case 'response-breakpoint':
            return <ResponseBreakpointStepConfig {...configProps} />;
        case 'request-and-response-breakpoint':
            return <RequestAndResponseBreakpointStepConfig {...configProps} />;
        case 'delay':
            return <WaitForDurationConfig {...configProps} />;
        case 'timeout':
            return <TimeoutStepConfig {...configProps} />;
        case 'close-connection':
            return <CloseConnectionStepConfig {...configProps} />;
        case 'reset-connection':
            return <ResetConnectionStepConfig {...configProps} />;
        case 'webhook':
            return <WebhookStepConfig {...configProps} />;

        case 'ws-echo':
            return <WebSocketEchoStepConfig {...configProps} />;
        case 'ws-reject':
            return <StaticResponseStepConfig {...configProps} />;
        case 'ws-listen':
            return <WebSocketListenStepConfig {...configProps} />;
        case 'eth-call-result':
            return <EthCallResultStepConfig {...configProps} />;
        case 'eth-number-result':
            return <EthNumberResultStepConfig {...configProps} />;
        case 'eth-hash-result':
            return <EthHashResultStepConfig {...configProps} />;
        case 'eth-receipt-result':
            return <EthReceiptResultStepConfig {...configProps} />;
        case 'eth-block-result':
            return <EthBlockResultStepConfig {...configProps} />;
        case 'eth-error':
            return <EthErrorStepConfig {...configProps} />;
        case 'ipfs-cat-text':
            return <IpfsCatTextStepConfig {...configProps} />;
        case 'ipfs-cat-file':
            return <IpfsCatFileStepConfig {...configProps} />;
        case 'ipfs-add-result':
            return <IpfsAddResultStepConfig {...configProps} />;
        case 'ipns-resolve-result':
            return <IpnsResolveResultStepConfig {...configProps} />;
        case 'ipns-publish-result':
            return <IpnsPublishResultStepConfig {...configProps} />;
        case 'ipfs-pins-result':
            return <IpfsPinsResultStepConfig {...configProps} />;
        case 'ipfs-pin-ls-result':
            return <IpfsPinLsResultStepConfig {...configProps} />;

        case 'rtc-dynamic-proxy':
            return <PassThroughStepConfig {...configProps} />;
        case 'echo-rtc':
            return <RTCEchoStepConfig {...configProps} />;
        case 'close-rtc-connection':
            return <RTCCloseStepConfig {...configProps} />;
        case 'wait-for-rtc-media':
            return <RTCWaitForMediaConfig {...configProps} />;
        case 'wait-for-duration':
            return <WaitForDurationConfig {...configProps} />;
        case 'wait-for-rtc-data-channel':
            return <RTCWaitForChannelConfig {...configProps} />;
        case 'wait-for-rtc-message':
            return <RTCWaitForDataMessageConfig {...configProps} />;
        case 'create-rtc-data-channel':
            return <RTCCreateChannelStepConfig {...configProps} />;
        case 'send-rtc-data-message':
            return <RTCSendMessageStepConfig {...configProps} />;

        default:
            throw new UnreachableCheck(stepKey);
    }
}

const SectionLabel = styled.h2`
    margin-bottom: 5px;
    &:not(:first-child) {
        margin-top: 10px;
    }

    text-transform: uppercase;
    font-family: ${p => p.theme.titleTextFamily};
    opacity: ${p => p.theme.lowlightTextOpacity};
    width: 100%;
`;

const ContentTypeSelect = styled(Select)`
    font-size: ${p => p.theme.textSize};
    width: auto;
`;

const WideTextInput = styled(TextInput)`
    width: 100%;
    box-sizing: border-box;
`;

const BodyHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    margin: 5px 0;

    > ${SectionLabel} {
        align-self: flex-end;
        flex-grow: 1;
        margin-bottom: 0;
        margin: 0;
    }

    > button {
        padding-top: 0;
        padding-bottom: 0;
    }
`;

const BodyContainer = styled.div<{ isInvalid?: boolean }>`
    margin-top: 5px;

    > div {
        margin-top: 5px;
        border-radius: 4px;
        border: solid 1px ${p => p.isInvalid
            ? p.theme.warningColor
            : p.theme.containerBorder
        };
        padding-right: 1px;
    }
`;

@observer
class StaticResponseStepConfig extends StepConfig<StaticResponseStep | RejectWebSocketStep> {

    @observable
    statusCode: number | undefined = (this.props.step instanceof StaticResponseStep)
        ? this.props.step.status
        : this.props.step.statusCode;

    @observable
    statusMessage = this.props.step.statusMessage;

    // We have to model raw header data here (even though steps use header objects) because want to mutate
    // the headers (e.g. appending content-type) without losing object-unrepresentable (e.g. dupe key order) UI state.
    @observable
    rawHeaders = headersToRawHeaders(this.props.step.headers || {});

    @computed
    get headers(): Headers {
        return rawHeadersToHeaders(this.rawHeaders);
    }
    set headers(headers: Headers | undefined) {
        if (_.isEqual(headers, this.headers)) return;
        if (headers === undefined && Object.keys(this.headers).length === 0) return;
        this.rawHeaders = headersToRawHeaders(headers || {});
    }

    @observable
    contentType: EditableContentType = 'text';

    @observable
    body = asBuffer(this.props.step instanceof StaticResponseStep
        ? this.props.step.data
        : this.props.step.body
    );

    componentDidMount() {
        // If any of our data fields change, rebuild & update the step
        disposeOnUnmount(this, reaction(() => {
            return JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'body']));
        }, () => this.updateStep()));

        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { status, statusMessage } = this.props.step instanceof StaticResponseStep
                ? this.props.step
                : { ...this.props.step, status: this.props.step.statusCode };

            runInAction(() => {
                this.statusCode = status;
                this.statusMessage = statusMessage;
            });
        }));
        disposeOnUnmount(this, autorun(() => {
            const { data } = this.props.step instanceof StaticResponseStep
                ? this.props.step
                : { data: this.props.step.body };

            runInAction(() => {
                this.body = asBuffer(data); // Usually returns data directly, since we set it as a buffer anyway
            });
        }));
        disposeOnUnmount(this, autorun(() => {
            const { headers } = this.props.step;

            runInAction(() => {
                this.headers = headers;
            });
        }));

        // If you enter a relevant content-type header, consider updating the editor content type:
        disposeOnUnmount(this, autorun(() => {
            const detectedContentType = getEditableContentType(getHeaderValue(this.rawHeaders, 'content-type'));
            if (detectedContentType) runInAction(() => {
                this.contentType = detectedContentType;
            });
            // If not a known type, we leave the content type as whatever it currently is
        }));

        // If you set the editor content type, keep the content-type header up to date
        disposeOnUnmount(this, observe(this, 'contentType', ({
            oldValue: previousContentType,
            newValue: newContentType
        }) => {
            const contentTypeHeader = getHeaderValue(this.rawHeaders, 'content-type');
            const expectedContentType = getDefaultMimeType(newContentType);

            if (!contentTypeHeader) {
                // If you pick a body content type with no header set, we add one
                runInAction(() => {
                    this.rawHeaders.push(['content-type', expectedContentType]);
                });
            } else {
                const headerContentType = getEditableContentType(contentTypeHeader);

                // If the body type changes, and the old header matched the old type, update the header
                if (previousContentType === headerContentType) {
                    runInAction(() => {
                        setHeaderValue(this.rawHeaders, 'content-type', expectedContentType);
                    });
                }
                // If there is a header, but it didn't match the body, leave it as-is
            }
        }));

        // If you change the body, and the content length _was_ correct, keep it up to date
        disposeOnUnmount(this, observe(this, 'body', ({
            oldValue: previousBody,
            newValue: newBody
        }) => {
            const lengthHeader = getHeaderValue(this.rawHeaders, 'content-length');

            if (!lengthHeader) return;

            if (parseInt(lengthHeader || '', 10) === byteLength(previousBody)) {
                runInAction(() => {
                    // If the content-length was previously correct, keep it correct:
                    runInAction(() => {
                        setHeaderValue(this.rawHeaders, 'content-length', byteLength(newBody).toString());
                    });
                });
            }
        }));
    }

    @computed
    private get textEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        return isProbablyUtf8(this.body)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const { statusCode, statusMessage, rawHeaders, body } = this;

        const bodyAsString = body.toString(this.textEncoding);

        return <ConfigContainer>
            <SectionLabel>Status</SectionLabel>
            <EditableStatus
                httpVersion={1}
                statusCode={statusCode}
                statusMessage={statusMessage}
                onChange={this.setStatus}
            />

            <SectionLabel>Headers</SectionLabel>
            <EditableRawHeaders
                headers={rawHeaders}
                onChange={this.onHeadersChanged}
            />

            <BodyHeader>
                <SectionLabel>Response body</SectionLabel>
                <FormatButton
                    format={this.contentType}
                    content={body}
                    onFormatted={this.setBody}
                />
                <ContentTypeSelect value={this.contentType} onChange={this.setContentType}>
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="javascript">JavaScript</option>
                </ContentTypeSelect>
            </BodyHeader>
            <BodyContainer>
                <SelfSizedEditor
                    contentId={null}
                    language={this.contentType}
                    value={bodyAsString}
                    onChange={this.setBody}
                />
            </BodyContainer>
        </ConfigContainer>;
    }

    @action.bound
    setStatus(statusCode: number | undefined, statusMessage: string | undefined) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
    }

    @action.bound
    onHeadersChanged(rawHeaders: RawHeaders) {
        this.rawHeaders = rawHeaders;
    }

    @action.bound
    setContentType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.contentType = value as EditableContentType;
    }

    @action.bound
    setBody(body: string) {
        this.body = stringToBuffer(body, this.textEncoding);
    }

    updateStep() {
        if (
            !this.statusCode ||
            this.statusCode < 100 ||
            this.statusCode >= 1000 ||
            this.rawHeaders.some(([key]) => !key.match(HEADER_NAME_REGEX)) ||
            this.rawHeaders.some(([_, value]) => !value)
        ) return this.props.onInvalidState();

        this.props.onChange(
            this.props.ruleType === 'http'
            ? new StaticResponseStep(
                this.statusCode,
                this.statusMessage,
                this.body,
                this.headers
            )
            : new RejectWebSocketStep(
                this.statusCode,
                this.statusMessage ?? getStatusMessage(this.statusCode),
                this.headers,
                this.body
            )
        );
    }
}

const BodyFileContainer = styled.div`
    margin-top: 1px;
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const BodyFileButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 10px 24px;

    flex-grow: 1;
    white-space: nowrap;
`;

const BodyFilePath = styled.div`
    margin-left: 15px;
    flex-shrink: 1;

    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-word;
`;

@observer
class FromFileResponseStepConfig extends StepConfig<FromFileResponseStep> {

    @observable
    statusCode: number | undefined = this.props.step.status;

    @observable
    statusMessage = this.props.step.statusMessage;

    @observable
    headers = this.props.step.headers || {};

    @observable
    filePath = (this.props.step.filePath || '').toString();

    componentDidMount() {
        // If any of our data fields change, rebuild & update the step
        disposeOnUnmount(this, reaction(() => (
            JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'filePath']))
        ), () => this.updateStep()));

        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { status, statusMessage, headers, filePath } = this.props.step;
            runInAction(() => {
                this.statusCode = status;
                this.statusMessage = statusMessage;
                this.headers = headers || {};
                this.filePath = filePath;
            });
        }));
    }

    render() {
        const { statusCode, statusMessage, headers } = this;

        return <ConfigContainer>
            <SectionLabel>Status</SectionLabel>
            <EditableStatus
                httpVersion={1}
                statusCode={statusCode}
                statusMessage={statusMessage}
                onChange={this.setStatus}
            />

            <SectionLabel>Headers</SectionLabel>
            <EditableHeaders
                headers={headers}
                convertToRawHeaders={headersToRawHeaders}
                convertFromRawHeaders={rawHeadersToHeaders}
                onChange={this.onHeadersChanged}
            />

            <SectionLabel>Response body</SectionLabel>
            <BodyFileContainer>
                <BodyFileButton onClick={this.selectFile}>
                    { this.filePath
                        ? 'Change file'
                        : <>
                            Select file <WarningIcon />
                        </>
                    }
                </BodyFileButton>
                { this.filePath && <BodyFilePath>
                    { this.filePath }
                </BodyFilePath> }
            </BodyFileContainer>

            <ConfigExplanation>
                All matching requests will receive a { this.statusCode } response, with the response
                body containing the contents of the selected file.
            </ConfigExplanation>
            <ConfigExplanation>
                This file will be read fresh for each request, so future changes to the file will
                immediately affect matching requests.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    setStatus(statusCode: number | undefined, statusMessage: string | undefined) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
    }

    @action.bound
    onHeadersChanged(headers: Headers) {
        this.headers = headers;
    }

    selectFile = async () => {
        const result = await uploadFile("path", []);
        if (result) {
            runInAction(() => {
                this.filePath = result;
            });
        }
    }

    updateStep() {
        if (
            !this.statusCode ||
            this.statusCode < 100 ||
            this.statusCode >= 1000 ||
            _.some(Object.keys(this.headers), (key) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new FromFileResponseStep(
                this.statusCode,
                this.statusMessage,
                this.filePath,
                this.headers
            )
        );
    }
}

const UrlInput = styled(TextInput)`
    margin-top: 5px;
    width: 100%;
    box-sizing: border-box;
`;

@inject('rulesStore')
@observer
class ForwardToHostStepConfig extends StepConfig<
    | ForwardToHostStep
    | WebSocketForwardToHostStep,
    {
        rulesStore?: RulesStore,
        stepKey: 'forward-to-host' | 'ws-forward-to-host'
    }
> {

    @observable
    private error: Error | undefined;

    @observable
    private target: string | undefined;

    @observable
    private updateHostHeader: true | false = true;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const savedTarget = this.savedTarget;
            const { updateHostHeader } = this.props.step.transformRequest?.replaceHost || {};
            runInAction(() => {
                this.target = savedTarget;
                this.updateHostHeader = updateHostHeader !== undefined
                    ? (!!updateHostHeader)
                    : true;
            });
        }));
    }

    @computed
    get savedTarget() {
        const { targetHost: savedTargetHost } = this.props.step.transformRequest?.replaceHost || {};
        const savedProtocol = this.props.step.transformRequest?.setProtocol || '';

        return savedProtocol
            ? `${savedProtocol}://${savedTargetHost}`
            : savedTargetHost;
    }

    render() {
        const {
            target,
            updateHostHeader,
            error,
            onTargetChange,
            onUpdateHeaderChange
        } = this;
        const { targetHost: savedTargetHost } = this.props.step.transformRequest?.replaceHost || {};
        const savedProtocol = this.props.step.transformRequest?.setProtocol || '';

        const savedTarget = savedProtocol
            ? `${savedProtocol}://${savedTargetHost}`
            : savedTargetHost;

        const messageType = this.props.stepKey === 'ws-forward-to-host'
            ? 'WebSocket'
            : 'request';

        return <ConfigContainer>
            <SectionLabel>Replacement host</SectionLabel>
            <UrlInput
                value={target || ''}
                invalid={!!error}
                spellCheck={false}
                onChange={onTargetChange}
            />

            <SectionLabel>Host header</SectionLabel>

            <HostHeaderSelector
                updateHostHeader={updateHostHeader}
                messageType={messageType}
                onUpdateHeaderChange={onUpdateHeaderChange}
            />

            { savedTarget &&
                <ConfigExplanation>
                    All matching {messageType}s will be forwarded to {savedTarget},
                    keeping their existing path{
                        !savedTarget.includes('://') ? ', protocol,' : ''
                    } and query string.{
                        updateHostHeader
                        ? ' Their host header will be automatically updated to match.'
                        : ''
                    }
                </ConfigExplanation>
            }
        </ConfigContainer>;
    }

    updateStep() {
        try {
            if (!this.target) throw new Error('A target host is required');

            let urlWithoutProtocol: string;

            const protocolMatch = this.target.match(/^(\w+):\/\//);
            if (protocolMatch) {
                const validProtocols = this.props.stepKey === 'ws-forward-to-host'
                    ? ['ws', 'wss']
                    : ['http', 'https'];

                if (!validProtocols.includes(protocolMatch[1].toLowerCase())) {
                    throw new Error(
                        `The protocol must be either ${validProtocols[0]} or ${validProtocols[1]}`
                    );
                }

                urlWithoutProtocol = this.target.slice(protocolMatch[0].length);
            } else {
                urlWithoutProtocol = this.target;
            }

            if (urlWithoutProtocol.includes('/')) {
                throw new Error(
                    'The replacement host shouldn\'t include a path, since it won\'t be used'
                );
            }
            if (urlWithoutProtocol.includes('?')) {
                throw new Error(
                    'The replacement host shouldn\'t include a query string, since it won\'t be used'
                );
            }

            const StepClass = this.props.stepKey === 'ws-forward-to-host'
                ? WebSocketForwardToHostStep
                : ForwardToHostStep;

            this.props.onChange(
                new StepClass(
                    protocolMatch ? protocolMatch[1] : undefined,
                    urlWithoutProtocol,
                    this.updateHostHeader,
                    this.props.rulesStore!
                )
            );
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = asError(e);
            if (this.props.onInvalidState) this.props.onInvalidState();
            throw e;
        }
    }

    @action.bound
    onTargetChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.target = event.target.value;

        try {
            this.updateStep();
            event.target.setCustomValidity('');
        } catch (e) {
            event.target.setCustomValidity(asError(e).message);
        }
        event.target.reportValidity();
    }

    @action.bound
    onUpdateHeaderChange(value: boolean) {
        this.updateHostHeader = value;

        try {
            this.updateStep();
        } catch (e) {
            // If there's an error, it must be in the host name, so it's reported elsewhere
        }
    }
}

const HostHeaderSelector = (props: {
    updateHostHeader: boolean,
    messageType: 'request' | 'WebSocket',
    onUpdateHeaderChange: (value: boolean) => void
}) => {
    return <Select
        value={props.updateHostHeader.toString()}
        onChange={e => props.onUpdateHeaderChange(e.target.value === 'true')}
        title={dedent`
            Most servers will not accept ${props.messageType}s that arrive
            with the wrong host header, so it's typically useful
            to automatically change it to match the new host
        `}
    >
        <option value={'true'}>Update the host header automatically (recommended)</option>
        <option value={'false'}>Leave the host header untouched</option>
    </Select>
}

const TransformSectionLabel = styled(SectionLabel)`
    margin-top: 10px;
`;

const TransformSectionSeparator = styled.hr`
    width: 100%;
    box-sizing: border-box;
    margin: 20px 0;
    border: solid 1px ${p => p.theme.containerWatermark};
`;

const TransformConfig = styled.div`
    margin: 0 0 5px 0;

    ${(p: { active: boolean }) => p.active && css`
        border-left: solid 5px ${p => p.theme.containerWatermark};

        &:focus-within {
            border-left: solid 5px ${p => p.theme.primaryInputBackground};
        }

        padding-left: 5px;

        margin: 10px 0 15px;

        @supports selector(:has(*:nth-child(2))) {
            margin: 0 0 15px 0;

            &:has(> *:nth-child(2)) {
                margin: 10px 0 15px;
            }
        }
    `}
`;

const TransformDetails = styled.div`
    > :first-child {
        margin-top: 0;
    }

    padding-top: 5px;
`;

const SelectTransform = styled(Select)`
    margin: 0;

    ${p => p.value === 'none' && css`
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
    `}
`;

@inject('rulesStore')
@observer
class TransformingStepConfig extends StepConfig<TransformingStep, { rulesStore?: RulesStore }> {

    @observable
    transformRequest = this.props.step.transformRequest || {};

    @observable
    transformResponse = this.props.step.transformResponse || {};

    render() {
        return <ConfigContainer>
            <TransformSectionLabel>Request Transforms:</TransformSectionLabel>
            <MethodTransformConfig
                replacementMethod={this.transformRequest?.replaceMethod}
                onChange={this.transformField('transformRequest')('replaceMethod')}
            />
            <UrlTransformConfig
                transform={this.transformRequest}
                onChange={this.transformField('transformRequest')}
            />
            <HeadersTransformConfig
                type='request'
                transform={this.transformRequest}
                onChange={this.transformField('transformRequest')}
            />
            <BodyTransformConfig
                type='request'
                transform={this.transformRequest}
                onChange={this.transformField('transformRequest')}
            />

            <TransformSectionSeparator />

            <TransformSectionLabel>Response Transforms:</TransformSectionLabel>
            <StatusTransformConfig
                replacementStatus={this.transformResponse?.replaceStatus}
                onChange={this.transformField('transformResponse')('replaceStatus')}
            />
            <HeadersTransformConfig
                type='response'
                transform={this.transformResponse}
                onChange={this.transformField('transformResponse')}
            />
            <BodyTransformConfig
                type='response'
                transform={this.transformResponse}
                onChange={this.transformField('transformResponse')}
            />
        </ConfigContainer>;
    }

    transformField = <T extends keyof this>(
        objName: T
    ) => <K extends keyof this[T]>(
        key: K
    ) => action(
        (value: this[T][K]) => {
            this[objName] = {
                ...this[objName],
                [key]: value
            };

            this.updateStep();
        }
    );

    updateStep() {
        this.props.onChange(new TransformingStep(
            this.props.rulesStore!,
            this.transformRequest,
            this.transformResponse
        ));
    }
}

const MethodTransformConfig = (props: {
    replacementMethod: string | undefined,
    onChange: (method: MethodName | undefined) => void
}) => {
    return <TransformConfig active={!!props.replacementMethod}>
        <SelectTransform
            aria-label='Select how the method should be transformed'
            value={props.replacementMethod ?? 'none'}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value as 'none' | MethodName;

                if (value === 'none') {
                    props.onChange(undefined);
                } else {
                    props.onChange(value);
                }
            }
        }>
            <option value='none'>Use the original request method</option>
            {
                MethodNames.map((name) =>
                    <option key={name} value={name}>
                        Replace the request method with { name }
                    </option>
                )
            }
        </SelectTransform>
    </TransformConfig>;
};

const UrlTransformKeys = [
    'setProtocol',
    'replaceHost',
    'matchReplaceHost',
    'matchReplacePath',
    'matchReplaceQuery'
] as const;

type UrlTransformKey = typeof UrlTransformKeys[number];

const UrlTransformConfig = (props: {
    transform: RequestTransform,
    onChange: <F extends UrlTransformKey>(field: F) => (value: RequestTransform[F] | undefined) => void
}) => {
    const isActive = UrlTransformKeys.some(k => !!props.transform[k]);
    const [modifyUrl, setModifyUrl] = React.useState(isActive);

    return <TransformConfig active={modifyUrl}>
        <SelectTransform
            aria-label='Select whether the request URL should be transformed'
            value={modifyUrl ? 'modify' : 'none'}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value as 'modify' | 'none';

                if (value === 'none') {
                    UrlTransformKeys.forEach((key) => props.onChange(key)(undefined));
                    setModifyUrl(false);
                } else {
                    setModifyUrl(true);
                }
            }
        }>
            <option value='none'>Use the original URL</option>
            <option value='modify'>Modify the request URL</option>
        </SelectTransform>
        { modifyUrl && <>
            <TransformSectionLabel>Request URL modifications</TransformSectionLabel>

            <TransformConfig active={!!props.transform.setProtocol}>
                <SelectTransform
                    aria-label='Select how the request protocol should be transformed'
                    value={props.transform.setProtocol || 'none'}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                        const value = event.target.value as 'none' | 'http' | 'https';

                        if (value === 'none') {
                            props.onChange('setProtocol')(undefined);
                        } else {
                            props.onChange('setProtocol')(value);
                        }
                    }
                }>
                    <option value='none'>Use the original request protocol</option>
                    <option value='http'>Change the request protocol to HTTP</option>
                    <option value='https'>Change the request protocol to HTTPS</option>
                </SelectTransform>
            </TransformConfig>

            <UrlHostTransformDetails
                transform={props.transform}
                onChange={props.onChange}
            />

            <UrlTransformDetails
                partName='path'
                transform={props.transform.matchReplacePath}
                onChange={props.onChange('matchReplacePath')}
            />

            <UrlTransformDetails
                partName='query'
                transform={props.transform.matchReplaceQuery}
                onChange={props.onChange('matchReplaceQuery')}
            />
        </> }
    </TransformConfig>
}

const UrlHostTransformDetails = (props: {
    transform: RequestTransform,
    onChange: <F extends 'replaceHost' | 'matchReplaceHost'>(field: F) => (value: RequestTransform[F] | undefined) => void
}) => {
    const hostTransform = props.transform.replaceHost ||
        props.transform.matchReplaceHost;

    const selected = props.transform.replaceHost
            ? 'replaceHost'
        : props.transform.matchReplaceHost
            ? 'matchReplaceHost'
        : 'none';


    const [updateHostHeader, setUpdateHostHeader] = React.useState(
        hostTransform?.updateHostHeader ?? true
    );

    return <TransformConfig active={selected !== 'none'}>
        <SelectTransform
            aria-label='Select how the request host should be transformed'
            value={selected ?? 'none'}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value as 'none' | 'replaceHost' | 'matchReplaceHost';

                if (value === 'none') {
                    props.onChange('replaceHost')(undefined);
                    props.onChange('matchReplaceHost')(undefined);
                } else if (value === 'replaceHost') {
                    props.onChange('matchReplaceHost')(undefined);
                    props.onChange('replaceHost')({ targetHost: '', updateHostHeader: true });
                } else {
                    props.onChange('replaceHost')(undefined);
                    props.onChange('matchReplaceHost')({ replacements: [], updateHostHeader: true });
                }
            }}
        >
            <option value='none'>Use the original request host</option>
            <option value='replaceHost'>Replace the request host</option>
            <option value='matchReplaceHost'>Match & replace parts of the request host</option>
        </SelectTransform>
        { selected === 'replaceHost' &&
            <TransformDetails>
                <TransformSectionLabel>Replacement host</TransformSectionLabel>
                <WideTextInput
                    placeholder='example.com'
                    spellCheck={false}

                    value={props.transform.replaceHost!.targetHost}
                    onChange={(event) => {
                        try {
                            const value = event.target.value;
                            props.onChange('replaceHost')({
                                targetHost: event.target.value,
                                updateHostHeader
                            });

                            if (!value) {
                                throw new Error('A replacement host is required');
                            }

                            event.target.setCustomValidity('');
                        } catch (e) {
                            const message = asError(e).message;
                            event.target.setCustomValidity(message);
                        }
                        event.target.reportValidity();
                    }}
                />
            </TransformDetails>
        }
        { selected === 'matchReplaceHost' &&
            <MatchReplaceTransformConfig
                replacements={props.transform.matchReplaceHost!.replacements}
                updateReplacements={(replacements) => {
                    props.onChange('matchReplaceHost')({
                        replacements,
                        updateHostHeader
                    });
                }}
                valueValidation={(hostValue) => {
                    if (hostValue.includes('/')) {
                        return `Request transform replacement hosts cannot include a path or protocol, but "${hostValue}" does`;
                    } else {
                        return true;
                    }
                }}
            />
        }
        { selected !== 'none' && <TransformDetails>
            <TransformSectionLabel>Host header</TransformSectionLabel>
            <HostHeaderSelector
                messageType='request'
                updateHostHeader={!!updateHostHeader}
                onUpdateHeaderChange={setUpdateHostHeader}
            />
        </TransformDetails> }
    </TransformConfig>;
}

const UrlTransformDetails = (props: {
    partName: 'path' | 'query',
    transform: MatchReplacePairs | undefined,
    onChange: (value: MatchReplacePairs | undefined) => void
}) => {
    const selected = props.transform !== undefined
        ? 'matchReplace'
        : 'none';

    return <TransformConfig active={selected !== 'none'}>
        <SelectTransform
            aria-label={`Select how the ${props.partName} should be transformed`}
            value={selected ?? 'none'}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value as 'none' | 'matchReplace';

                if (value === 'none') {
                    props.onChange(undefined);
                } else {
                    props.onChange([]);
                }
            }
        }>
            <option value='none'>Use the original request {props.partName}</option>
            <option value='matchReplace'>Match & replace parts of the request {props.partName}</option>
        </SelectTransform>
        { selected === 'matchReplace' &&
            <MatchReplaceTransformConfig
                replacements={props.transform!}
                updateReplacements={props.onChange}
            />
        }
    </TransformConfig>;
};

const StatusTransformConfig = (props: {
    replacementStatus: number | undefined,
    onChange: (status: number | undefined) => void
}) => {
    const selected = props.replacementStatus !== undefined
        ? 'replace'
        : 'none';

    return <TransformConfig active={selected !== 'none'}>
        <SelectTransform
            aria-label='Select how the status should be transformed'
            value={selected ?? 'none'}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value as 'none' | 'replace';

                if (value === 'none') {
                    props.onChange(undefined);
                } else {
                    props.onChange(200);
                }
            }
        }>
            <option value='none'>Use the original response status</option>
            <option value='replace'>Replace the response status</option>
        </SelectTransform>
        {
            selected === 'replace' && <TransformDetails>
                <EditableStatus
                    statusCode={props.replacementStatus}
                    onChange={props.onChange}
                    // We don't bother supporting status message transforms:
                    httpVersion={2}
                    statusMessage={undefined}
                />
            </TransformDetails>
        }
    </TransformConfig>
};

@observer
class HeadersTransformConfig<T extends RequestTransform | ResponseTransform> extends React.Component<{
    type: 'request' | 'response',
    transform: T,
    onChange: <K extends typeof HeadersTransformConfig.FIELDS[number]>(updatedField: K) => (updatedValue: T[K]) => void
}> {

    private static readonly FIELDS = [
        'replaceHeaders',
        'updateHeaders'
    ] as const;

    @computed
    get selected() {
        return _.find(HeadersTransformConfig.FIELDS, (field) =>
            this.props.transform[field] !== undefined
        ) ?? 'none';
    }

    @computed
    get headers() {
        if (this.selected === 'none') return {};
        return this.props.transform[this.selected] || {};
    }

    render() {
        const { type } = this.props;
        const {
            selected,
            convertResultFromRawHeaders,
            onTransformTypeChange,
            setHeadersValue
        } = this;

        return <TransformConfig active={selected !== 'none'}>
            <SelectTransform
                aria-label={`Select how the ${type} headers should be transformed`}
                value={selected}
                onChange={onTransformTypeChange}
            >
                <option value='none'>Use the original { type } headers</option>
                <option value='updateHeaders'>Update the { type } headers</option>
                <option value='replaceHeaders'>Replace the { type } headers</option>
            </SelectTransform>
            {
                selected !== 'none' && <TransformDetails>
                    <EditableHeaders
                        headers={this.headers}
                        convertToRawHeaders={headersToRawHeaders}
                        convertFromRawHeaders={convertResultFromRawHeaders}
                        onChange={setHeadersValue}
                        allowEmptyValues={selected === 'updateHeaders'}
                    />
                </TransformDetails>
            }
        </TransformConfig>;
    }

    convertResultFromRawHeaders = (headers: RawHeaders): Headers => {
        if (this.selected === 'updateHeaders') {
            return rawHeadersToHeaders(
                headers.map(([key, value]) =>
                    [key, value === '' ? undefined as any : value] // => undefined to explicitly remove headers
            ));
        } else {
            return rawHeadersToHeaders(headers);
        }
    };

    @action.bound
    setHeadersValue(value: Headers) {
        this.clearValues();
        if (this.selected !== 'none') {
            this.props.onChange(this.selected)(value);
        }
    }

    @action.bound
    onTransformTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value as 'none' | typeof HeadersTransformConfig.FIELDS[number];

        this.clearValues();
        if (value !== 'none') this.props.onChange(value)({});
    };

    @action.bound
    clearValues() {
        HeadersTransformConfig.FIELDS.forEach((field) =>
            this.props.onChange(field)(undefined)
        );
    }
};

@observer
class BodyTransformConfig<T extends RequestTransform | ResponseTransform> extends React.Component<{
    type: 'request' | 'response',
    transform: T,
    onChange: <K extends typeof BodyTransformConfig.FIELDS[number]>(updatedField: K) => (updatedValue: T[K]) => void
}> {

    private static readonly FIELDS = [
        'replaceBody',
        'replaceBodyFromFile',
        'updateJsonBody',
        'patchJsonBody',
        'matchReplaceBody'
    ] as const satisfies ReadonlyArray<keyof RequestTransform & ResponseTransform>;

    @computed
    get bodyReplacementBuffer() {
        return asBuffer(this.props.transform.replaceBody);
    }

    render() {
        const { type, transform } = this.props;
        const {
            bodyReplacementBuffer,
            onTransformTypeChange,
            setBodyReplacement,
            selectBodyReplacementFile,
            setJsonBodyUpdate,
            setJsonBodyPatch
        } = this;

        const advancedPatchesSupported = serverSupports(ADVANCED_PATCH_TRANSFORMS);

        const selected = _.find(BodyTransformConfig.FIELDS, (field) =>
            transform[field] !== undefined
        ) ?? 'none';

        return <TransformConfig active={selected !== 'none'}>
            <SelectTransform
                aria-label={`Select how the ${type} body should be transformed`}
                value={selected}
                onChange={onTransformTypeChange}>
                <option value='none'>Use the original { type } body</option>
                <option value='replaceBody'>Replace the { type } body with a fixed value</option>
                <option value='replaceBodyFromFile'>Replace the { type } body with a file</option>
                <option value='updateJsonBody'>Update a JSON { type } body by merging data</option>
                { advancedPatchesSupported && <>
                    <option value='patchJsonBody'>Update a JSON { type } body using JSON patch</option>
                    <option value='matchReplaceBody'>Match & replace text in the { type } body</option>
                </> }
            </SelectTransform>
            {
                selected === 'replaceBody'
                    ? <RawBodyTransformConfig
                        type={type}
                        body={bodyReplacementBuffer}
                        updateBody={setBodyReplacement}
                    />
                : selected === 'replaceBodyFromFile'
                    ? <TransformDetails>
                        <BodyFileContainer>
                            <BodyFileButton onClick={selectBodyReplacementFile}>
                                { transform.replaceBodyFromFile
                                    ? 'Change file'
                                    : <>
                                        Select file <WarningIcon />
                                    </>
                                }
                            </BodyFileButton>
                            { transform.replaceBodyFromFile && <BodyFilePath>
                                { transform.replaceBodyFromFile }
                            </BodyFilePath> }
                        </BodyFileContainer>
                    </TransformDetails>
                : selected === 'updateJsonBody'
                    ? <JsonUpdateTransformConfig
                        type={type}
                        body={transform.updateJsonBody!}
                        updateBody={setJsonBodyUpdate}
                    />
                : selected === 'patchJsonBody'
                    ? <JsonPatchTransformConfig
                        type={type}
                        operations={transform.patchJsonBody!}
                        updateOperations={setJsonBodyPatch}
                    />
                : selected === 'matchReplaceBody'
                    ? <MatchReplaceTransformConfig
                        replacements={transform.matchReplaceBody!}
                        updateReplacements={this.props.onChange('matchReplaceBody')}
                    />
                : selected === 'none'
                    ? null
                : unreachableCheck(selected)
            }
        </TransformConfig>;
    }

    onTransformTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value as 'none' | typeof BodyTransformConfig.FIELDS[number];

        this.clearValues();
        if (value === 'updateJsonBody') {
            this.props.onChange('updateJsonBody')({});
        } else if (value === 'patchJsonBody') {
            this.props.onChange('patchJsonBody')([]);
        } else if (value === 'replaceBody') {
            this.props.onChange('replaceBody')('');
        } else if (value === 'replaceBodyFromFile') {
            this.props.onChange('replaceBodyFromFile')('');
        } else if (value === 'matchReplaceBody') {
            this.props.onChange('matchReplaceBody')([]);
        } else if (value === 'none') {
            return;
        } else unreachableCheck(value);
    };

    @action.bound
    clearValues() {
        BodyTransformConfig.FIELDS.forEach((field) =>
            this.props.onChange(field)(undefined)
        );
    };

    @action.bound
    setBodyReplacement(body: string) {
        this.clearValues();
        this.props.onChange('replaceBody')(body);
    };

    selectBodyReplacementFile = async () => {
        const result = await uploadFile("path", []);
        if (result) {
            runInAction(() => {
                this.clearValues();
                this.props.onChange('replaceBodyFromFile')(result);
            });
        }
    };

    @action.bound
    setJsonBodyUpdate(body: {}) {
        this.clearValues();
        this.props.onChange('updateJsonBody')(body);
    };

    @action.bound
    setJsonBodyPatch(operations: Array<JsonPatchOperation>) {
        this.clearValues();
        this.props.onChange('patchJsonBody')(operations);
    };
};

const RawBodyTransformConfig = (props: {
    type: 'request' | 'response',
    body: Buffer,
    updateBody: (body: string) => void
}) => {
    const [contentType, setContentType] = React.useState<EditableContentType>('text');
    const onContentTypeChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
        setContentType(e.target.value as EditableContentType);

    return <TransformDetails>
        <BodyHeader>
            <SectionLabel>Replacement { props.type } body</SectionLabel>
            <FormatButton
                format={contentType}
                content={props.body}
                onFormatted={props.updateBody}
            />
            <ContentTypeSelect value={contentType} onChange={onContentTypeChanged}>
                <option value="text">Plain text</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="javascript">JavaScript</option>
            </ContentTypeSelect>
        </BodyHeader>
        <BodyContainer>
            <SelfSizedEditor
                contentId={null}
                language={contentType}
                value={bufferToString(props.body)}
                onChange={props.updateBody}
            />
        </BodyContainer>
    </TransformDetails>;
};

const StandaloneFormatButton = styled(FormatButton)`
    padding-right: 0;
`;

const JsonUpdateTransformConfig = (props: {
    type: 'request' | 'response',
    body: {},
    updateBody: (body: {}) => void
}) => {
    const [error, setError] = React.useState<Error>();

    const [bodyString, setBodyString] = React.useState<string>(
        JSON.stringify(props.body, null, 2)
    );

    React.useEffect(() => {
        try {
            props.updateBody(JSON.parse(bodyString));
            setError(undefined);
        } catch (e) {
            setError(asError(e));
        }
    }, [bodyString]);

    return <TransformDetails>
        <BodyHeader>
            <SectionLabel>JSON to merge into { props.type } body</SectionLabel>
            { error && <WarningIcon title={error.message} /> }

            <StandaloneFormatButton
                format='json'
                content={asBuffer(bodyString)}
                onFormatted={setBodyString}
            />
        </BodyHeader>
        <BodyContainer isInvalid={!!error}>
            <SelfSizedEditor
                contentId={null}
                language='json'
                value={bodyString}
                onChange={(content) => setBodyString(content)}
            />
        </BodyContainer>
    </TransformDetails>;
};

const JsonPatchTransformConfig = (props: {
    type: 'request' | 'response',
    operations: Array<JsonPatchOperation>,
    updateOperations: (operations: Array<JsonPatchOperation>) => void
}) => {
    const [error, setError] = React.useState<Error>();

    const [operationsString, setOperationsString] = React.useState<string>(
        JSON.stringify(props.operations, null, 2)
    );

    React.useEffect(() => {
        try {
            const parsedInput = JSON.parse(operationsString);

            const validationError = validateJsonPatch(parsedInput);
            if (validationError) throw validationError;

            props.updateOperations(parsedInput);
            setError(undefined);
        } catch (e) {
            setError(asError(e));
        }
    }, [operationsString]);

    return <TransformDetails>
        <BodyHeader>
            <SectionLabel>JSON { props.type } body patch (see <a
                href="https://jsonpatch.com/"
            >jsonpatch.com</a>)</SectionLabel>
            { error && <WarningIcon title={error.message} /> }

            <StandaloneFormatButton
                format='json'
                content={asBuffer(operationsString)}
                onFormatted={setOperationsString}
            />
        </BodyHeader>
        <BodyContainer isInvalid={!!error}>
            <SelfSizedEditor
                contentId={null}
                language='json'
                value={operationsString}
                onChange={(content) => setOperationsString(content)}
            />
        </BodyContainer>
    </TransformDetails>;
};

const MatchReplaceTransformConfig = (props: {
    replacements: MatchReplacePairs,
    updateReplacements: (replacements: MatchReplacePairs) => void,
    valueValidation?: (value: string) => true | string
}) => {
    const [error, setError] = React.useState<Error>();

    const [replacementPairs, updatePairs] = React.useState<PairsArray>(
        props.replacements.map(([match, replace]) => ({
            key: match instanceof RegExp
                ? match.source
                // It's type-possible to get a string here (since Mockttp supports it)
                // but it shouldn't be runtime-possible as we always use regex
                : _.escapeRegExp(match),
            value: replace
        }))
    );

    React.useEffect(() => {
        try {
            const validPairs = replacementPairs.filter((pair) =>
                validateRegexMatcher(pair.key) === true
            );
            const invalidCount = replacementPairs.length - validPairs.length;

            props.updateReplacements(validPairs.map(({ key, value }) =>
                [new RegExp(key, 'g'), value]
            ));

            if (invalidCount > 0) {
                throw new Error(
                    `${invalidCount} regular expression${invalidCount === 1 ? ' is' : 's are'} invalid`
                );
            }

            setError(undefined);
        } catch (e) {
            setError(asError(e));
        }
    }, [replacementPairs]);

    return <TransformDetails>
        <BodyHeader>
            <SectionLabel>Regex matchers & replacements</SectionLabel>
            { error && <WarningIcon title={error.message} /> }
        </BodyHeader>
        <MonoKeyEditablePairs
            pairs={replacementPairs}
            onChange={updatePairs}
            keyPlaceholder='Regular expression to match'
            valuePlaceholder='Replacement value'
            keyValidation={validateRegexMatcher}
            valueValidation={props.valueValidation}
            allowEmptyValues={true}
        />
    </TransformDetails>;
};

const MonoKeyEditablePairs = styled(EditablePairs<PairsArray>)`
    input:nth-of-type(odd) {
        font-family: ${p => p.theme.monoFontFamily};
    }
`;

const validateRegexMatcher = (value: string): true | string => {
    try {
        new RegExp(value, 'g');
        return true;
    } catch (e: any) {
        return e.message ?? e.toString();
    }
}

@observer
class WebhookStepConfig extends StepConfig<WebhookStep> {

    @observable
    private error: Error | undefined;

    @observable
    webhookUrl: string = this.props.step.url;

    @observable
    events: Array<RequestWebhookEvents> = this.props.step.events;

    render() {
        return <ConfigContainer>
            <SectionLabel>Webhook target URL</SectionLabel>
            <UrlInput
                type="url"
                value={this.webhookUrl}
                invalid={!!this.error}
                spellCheck={false}
                onChange={this.onUrlChange}
            />

            <SectionLabel>Webhook events</SectionLabel>

            <label>
                <input type="checkbox"
                    checked={this.events.includes('request')}
                    onChange={(e) => this.setEvent('request', e.target.checked)}
                />
                Request received
            </label>
            <br />
            <label>
                <input
                    type="checkbox"
                    checked={this.events.includes('response')}
                    onChange={(e) => this.setEvent('response', e.target.checked)}
                />
                Response sent
            </label>
        </ConfigContainer>;
    }

    @action.bound
    onUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.webhookUrl = event.target.value;
        this.updateStep(event.target);
    }

    @action.bound
    setEvent(event: RequestWebhookEvents, enabled: boolean) {
        if (enabled && !this.events.includes(event)) {
            this.events.push(event);
        } else if (!enabled && this.events.includes(event)) {
            this.events.splice(this.events.indexOf(event), 1);
        }
        this.updateStep();
    }

    updateStep(target?: HTMLInputElement) {
        try {
            if (!this.webhookUrl) throw new Error('A webhook URL is required');

            this.props.onChange(new WebhookStep(this.webhookUrl, this.events));

            this.error = undefined;
            target?.setCustomValidity('');
        } catch (e) {
            this.error = asError(e);
            target?.setCustomValidity(this.error.message);
            if (this.props.onInvalidState) this.props.onInvalidState();
        }
        target?.reportValidity();
    }
}

@observer
class PassThroughStepConfig extends StepConfig<
    | PassThroughStep
    | WebSocketPassThroughStep
    | DynamicProxyStep
> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching {
                    isHttpCompatibleType(this.props.ruleType)
                        ? 'requests'
                    : this.props.ruleType === 'websocket'
                        ? 'WebSockets'
                    : this.props.ruleType === 'webrtc'
                        ? 'data and media'
                    : unreachableCheck(this.props.ruleType)
                } will be transparently passed through to the upstream {
                    this.props.ruleType === 'webrtc'
                        ? 'RTC peer, once one is connected'
                        : 'target host'
                }.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class RequestBreakpointStepConfig extends StepConfig<RequestBreakpointStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will breakpoint when a request is sent.
            </ConfigExplanation>
            <ConfigExplanation>
                Once a request is breakpointed, you can edit the request URL to redirect
                the request elsewhere, edit the method, headers, or body before they are sent upstream,
                or provide your own response manually so the request is never sent onwards at all.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class ResponseBreakpointStepConfig extends StepConfig<ResponseBreakpointStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will breakpoint when a response is received from the upstream server.
            </ConfigExplanation>
            <ConfigExplanation>
                Once a response is breakpointed, you can rewrite the received message, to edit the status
                code, headers or body before they're returned to the downstream HTTP client.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class RequestAndResponseBreakpointStepConfig extends StepConfig<RequestAndResponseBreakpointStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will breakpoint when a request is sent, and when a response
                is received.
            </ConfigExplanation>
            <ConfigExplanation>
                From a request breakpoint, you can edit the request URL to redirect
                the request elsewhere, edit the method, headers, or body before they are sent upstream,
                or provide your own response manually so the request is never sent onwards at all.
            </ConfigExplanation>
            <ConfigExplanation>
                From a response breakpoint, you can rewrite a received response, to edit the status
                code, headers or body before they're returned to the downstream HTTP client.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class TimeoutStepConfig extends StepConfig<TimeoutStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                The {
                    isHttpCompatibleType(this.props.ruleType)
                        ? 'request'
                    : this.props.ruleType === 'websocket'
                        ? 'WebSocket'
                    : this.props.ruleType === 'webrtc'
                        ? (() => { throw new Error('Not compatible with WebRTC rules') })()
                    : unreachableCheck(this.props.ruleType)
                } will receive no response, keeping the connection open but doing nothing.
                With no data or response, most clients will time out and abort the
                request after sufficient time has passed.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class CloseConnectionStepConfig extends StepConfig<CloseConnectionStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                The {
                    isHttpCompatibleType(this.props.ruleType)
                        ? 'request'
                    : this.props.ruleType === 'websocket'
                        ? 'WebSocket'
                    : this.props.ruleType === 'webrtc'
                        ? (() => { throw new Error('Not compatible with WebRTC rules') })()
                    : unreachableCheck(this.props.ruleType)
                }'s connection will be cleanly closed, with no response.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class ResetConnectionStepConfig extends StepConfig<ResetConnectionStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                The {
                    isHttpCompatibleType(this.props.ruleType)
                        ? 'request'
                    : this.props.ruleType === 'websocket'
                        ? 'WebSocket'
                    : this.props.ruleType === 'webrtc'
                        ? (() => { throw new Error('Not compatible with WebRTC rules') })()
                    : unreachableCheck(this.props.ruleType)
                }'s connection will be abruptly killed with a TCP RST packet (or a
                RST_STREAM frame, for HTTP/2).
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class WebSocketEchoStepConfig extends StepConfig<EchoWebSocketStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                The WebSocket will be opened successfully, but not forwarded upstream, and every
                message that's sent will be echoed back to the client until the client closes
                the connection.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class WebSocketListenStepConfig extends StepConfig<ListenWebSocketStep> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                The WebSocket will be opened successfully, but not forwarded upstream. All
                messages from the client will be accepted, but no responses will be sent.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

const NATIVE_ETH_TYPES_PATTERN = `(${NATIVE_ETH_TYPES.join('|')})(\\[\\])?`;

@observer
class EthCallResultStepConfig extends StepConfig<EthereumCallResultStep> {

    @observable
    typeValuePairs: PairsArray = [];

    @observable error: Error | undefined;

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { outputTypes, values } = this.props.step;

            const stringValues = values.map(v => {
                if (Array.isArray(v)) return v.join(', ');
                else return (v as any)?.toString();
            });

            runInAction(() => {
                this.typeValuePairs = _.zip(outputTypes, stringValues)
                    .map(([key, value]) => ({ key, value })) as PairsArray;
            });
        }));
    }

    render() {
        const { typeValuePairs } = this;
        const encodedData = this.props.step.result.result;

        return <ConfigContainer>
            <SectionLabel>Eth_Call return values</SectionLabel>

            <EditablePairs
                pairs={typeValuePairs}
                onChange={this.onChange}
                keyPlaceholder='Return value type (e.g. string, int256, etc)'
                keyValidation={NATIVE_ETH_TYPES_PATTERN}
                valuePlaceholder='Return value'
                allowEmptyValues={true}
            />

            { this.error
                ? <>
                    <ConfigExplanation>
                        <WarningIcon /> Could not encode data. { this.error.message }
                    </ConfigExplanation>
                </>
                : <>
                    <ConfigExplanation>
                        Encoded return value:
                    </ConfigExplanation>
                    <ContentMonoValue>
                        { encodedData }
                    </ContentMonoValue>
                </>
            }

            <ConfigExplanation>
                All matching Ethereum JSON-RPC calls will be intercepted, and the encoded output
                above returned directly, without forwarding the call to the real Ethereum node.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChange(newPairs: PairsArray) {
        this.typeValuePairs = newPairs;

        // Allow array values, separated by commas:
        const parsedValues = this.typeValuePairs.map(({ key, value }) => {
            if (key === 'string[]') {
                return { key, value: value.split(/,\s?/g) };
            } else if (key.startsWith('bytes') || key.endsWith('[]')) {
                return { key, value: value.split(/,\s?/g).map(x => parseInt(x, 10)) };
            } else {
                return { key, value };
            }
        });

        try {
            this.props.onChange(
                new EthereumCallResultStep(
                    parsedValues.map(({ key }) => key),
                    parsedValues.map(({ value }) => value)
                )
            );
            this.error = undefined;
        } catch (err) {
            if (!isErrorLike(err)) throw err;

            if (err.code === 'INVALID_ARGUMENT') {
                const { argument, value, reason } = err as {
                    argument: string,
                    value: string,
                    reason: string
                };

                if (argument === 'type' || argument === 'param') {
                    this.error = new Error(`Invalid type: ${value}`);
                } else if (argument === 'value') {
                    this.error = new Error(`Invalid value: '${value}' (${reason})`);
                } else {
                    this.error = err as Error;
                }
            } else {
                this.error = err as Error;
            }

            this.props.onInvalidState();
        }
    }
}

@observer
class EthNumberResultStepConfig extends StepConfig<EthereumNumberResultStep> {

    @observable
    value: number | '' = this.props.step.value;

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { value } = this.props.step;
            runInAction(() => {
                if (value === 0 && this.value === '') return; // Allows clearing the input, making it *implicitly* 0
                this.value = value;
            });
        }));
    }

    render() {
        const { value } = this;

        return <ConfigContainer>
            <SectionLabel>Return value</SectionLabel>

            <WideTextInput
                type='number'
                min={0}
                value={value}
                onChange={this.onChange}
            />

            <ConfigExplanation>
                All matching Ethereum JSON-RPC requests will be intercepted, and { this.value } will
                be returned directly, without forwarding the call to the real Ethereum node.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;

        const newValue = (inputValue !== '')
            ? parseInt(inputValue, 10)
            : '';

        if (_.isNaN(newValue)) return; // I.e. reject the edit

        this.value = newValue;

        this.props.onChange(
            new EthereumNumberResultStep(newValue || 0)
        );
    }
}

@observer
class EthHashResultStepConfig extends StepConfig<EthereumHashResultStep> {

    @observable
    value = this.props.step.value;

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { value } = this.props.step;
            runInAction(() => { this.value = value; });
        }));
    }

    render() {
        const { value } = this;

        return <ConfigContainer>
            <SectionLabel>Return hash value</SectionLabel>

            <WideTextInput
                type='text'
                value={value}
                onChange={this.onChange}
            />

            <ConfigExplanation>
                All matching Ethereum JSON-RPC requests will be intercepted, and { this.value } will
                be returned directly, without forwarding the call to the real Ethereum node.
            </ConfigExplanation>

            <ConfigExplanation>
                <WarningIcon /> In most cases, you will also want to add a rule for transaction receipts
                matching this value, to mock subsequent queries for the transaction's result.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const newValue = event.target.value;

        if (!/^0x[0-9a-fA-F]*$/.test(newValue)) return; // Ignore anything that's not a valid hash

        this.props.onChange(
            new EthereumHashResultStep(event.target.value)
        );
    }
}

// Base component, used to build the various "JSON input into a JSON-wrapping step" configs
@observer
class JsonBasedStepConfig<H extends Step> extends StepConfig<H, {
    name: string,
    explanation: string[],
    stepFactory: (body: any) => H,
    valueGetter: (step: H) => unknown
}> {

    @observable
    valueString: string = JSON.stringify(this.props.valueGetter(this.props.step), null, 2);

    @observable
    error: Error | undefined;

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, reaction(
            () => JSON.stringify(this.props.valueGetter(this.props.step), null, 2),
            (stepStringValue) => {
                let normalizedCurrentValue: {} | undefined;
                try {
                    normalizedCurrentValue = JSON.stringify(JSON.parse(this.valueString), null, 2);
                } catch (err) { }

                // If the step value changes, and either it doesn't match the existing value here,
                // or the existing value isn't parseable at all, we reset the editor value:
                if (stepStringValue !== normalizedCurrentValue) {
                    runInAction(() => {
                        this.valueString = stepStringValue;
                        this.error = undefined;
                    });
                }
            }
        ));
    }

    render() {
        const { valueString, error } = this;
        const { name, explanation } = this.props;

        return <ConfigContainer>
            <BodyHeader>
                <SectionLabel>{ name }</SectionLabel>
                { error && <WarningIcon title={error.message} /> }

                <StandaloneFormatButton
                    format='json'
                    content={asBuffer(valueString)}
                    onFormatted={this.onChange}
                />
            </BodyHeader>
            <BodyContainer isInvalid={!!error}>
                <SelfSizedEditor
                    contentId={null}
                    language='json'
                    value={valueString}
                    onChange={this.onChange}
                />
            </BodyContainer>

            { explanation.map((explanationPart, i) =>
                <ConfigExplanation key={i}>
                    { explanationPart }
                </ConfigExplanation>
            ) }
        </ConfigContainer>;
    }

    @action.bound
    onChange(newContent: string) {
        this.valueString = newContent;

        try {
            const newValue = JSON.parse(newContent);
            this.props.onChange(
                this.props.stepFactory(newValue)
            );
            this.error = undefined;
        } catch (e) {
            if (!isErrorLike(e)) throw e;
            this.error = e as Error;
            this.props.onInvalidState();
        }
    }
}

@observer
class EthReceiptResultStepConfig extends StepConfig<EthereumReceiptResultStep> {

    render() {
        return <JsonBasedStepConfig
            name='Ethereum Transaction Receipt'
            explanation={[
                'All matching Ethereum JSON-RPC requests will be intercepted, and this transaction ' +
                'receipt will returned directly, without forwarding the call to the real Ethereum node.'
            ]}
            stepFactory={(data) => new EthereumReceiptResultStep(data)}
            valueGetter={step => step.receiptValue}
            { ...this.props }
        />;
    }

}

@observer
class EthBlockResultStepConfig extends StepConfig<EthereumBlockResultStep> {

    render() {
        return <JsonBasedStepConfig
            name='Ethereum Block Data'
            explanation={[
                'All matching Ethereum JSON-RPC requests will be intercepted, and this fixed block data ' +
                'will returned directly, without forwarding the call to the real Ethereum node.'
            ]}
            stepFactory={(data) => new EthereumBlockResultStep(data)}
            valueGetter={step => step.blockValue}
            { ...this.props }
        />;
    }

}

@observer
class EthErrorStepConfig extends StepConfig<EthereumErrorStep> {

    @observable
    inputError: Error | undefined; // A form error - not error data for the step, unlike the rest

    @observable
    errorMessage = this.props.step.message;

    @observable
    errorCode: '' | number = this.props.step.code || '';

    @observable
    errorData = this.props.step.data;

    @observable
    errorName = this.props.step.name;

    componentDidMount() {
        // If any of our data fields change, rebuild & update the step
        disposeOnUnmount(this, reaction(() => (
            JSON.stringify(_.pick(this, ['errorMessage', 'errorCode', 'errorData', 'errorName']))
        ), () => this.updateStep()));

        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { message, code, data, name } = this.props.step;

            runInAction(() => {
                this.errorMessage = message;
                this.errorData = data;
                this.errorName = name;

                if (this.errorCode === '' && code === 0) {
                    // Do nothing - this allows you to clear the field without fuss
                } else {
                    this.errorCode = code;
                }
            });
        }));
    }

    render() {
        const {
            errorMessage,
            errorCode,
            errorData,
            errorName
        } = this;

        return <ConfigContainer>
            <SectionLabel>Error Message</SectionLabel>
            <WideTextInput
                type='text'
                value={errorMessage}
                onChange={this.onChangeMessage}
            />

            <SectionLabel>Error Code</SectionLabel>
            <WideTextInput
                type='number'
                value={errorCode}
                onChange={this.onChangeCode}
            />

            <SectionLabel>Error Data</SectionLabel>
            <WideTextInput
                type='text'
                value={errorData}
                onChange={this.onChangeData}
            />

            <SectionLabel>Error Name</SectionLabel>
            <WideTextInput
                type='text'
                value={errorName || ''}
                onChange={this.onChangeName}
            />

            <ConfigExplanation>
                All matching Ethereum JSON-RPC requests will be intercepted, and this error response
                will returned directly, without forwarding the call to the real Ethereum node.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChangeMessage(event: React.ChangeEvent<HTMLInputElement>) {
        this.errorMessage = event.target.value;
    }

    @action.bound
    onChangeCode(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;
        if (!inputValue) {
            this.errorCode = '';
            return;
        }

        const value = parseInt(inputValue, 10);
        if (!_.isNaN(value)) {
            this.errorCode = value;
        }
    }

    @action.bound
    onChangeData(event: React.ChangeEvent<HTMLInputElement>) {
        this.errorData = event.target.value;
    }

    @action.bound
    onChangeName(event: React.ChangeEvent<HTMLInputElement>) {
        this.errorName = event.target.value;
    }

    updateStep() {
        this.props.onChange(
            new EthereumErrorStep(
                this.errorMessage,
                this.errorData,
                this.errorCode || 0,
                this.errorName
            )
        );
    }
}

@observer
class IpfsCatTextStepConfig extends StepConfig<IpfsCatTextStep> {

    @observable
    contentType: EditableContentType = 'text';

    @observable
    body = asBuffer(this.props.step.data);

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { data } = this.props.step;
            runInAction(() => {
                this.body = asBuffer(data);
            });
        }));
    }

    @computed
    private get textEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        return isProbablyUtf8(this.body)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const { body } = this;

        const bodyAsString = body.toString(this.textEncoding);

        return <ConfigContainer>
            <BodyHeader>
                <SectionLabel>IPFS content</SectionLabel>
                <FormatButton
                    format={this.contentType}
                    content={body}
                    onFormatted={this.setBody}
                />
                <ContentTypeSelect value={this.contentType} onChange={this.setContentType}>
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="javascript">JavaScript</option>
                </ContentTypeSelect>
            </BodyHeader>
            <BodyContainer>
                <SelfSizedEditor
                    contentId={null}
                    language={this.contentType}
                    value={bodyAsString}
                    onChange={this.setBody}
                />
            </BodyContainer>
        </ConfigContainer>;
    }

    @action.bound
    setContentType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.contentType = value as EditableContentType;
    }

    @action.bound
    setBody(body: string) {
        this.body = stringToBuffer(body, this.textEncoding);
        this.props.onChange(
            new IpfsCatTextStep(this.body)
        );
    }
}


@observer
class IpfsCatFileStepConfig extends StepConfig<FromFileResponseStep> {

    @observable
    filePath = (this.props.step.filePath || '').toString();

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { filePath } = this.props.step;
            runInAction(() => {
                this.filePath = filePath;
            });
        }));
    }

    render() {
        return <ConfigContainer>
            <SectionLabel>IPFS content</SectionLabel>
            <BodyFileContainer>
                <BodyFileButton onClick={this.selectFile}>
                    { this.filePath
                        ? 'Change file'
                        : <>
                            Select file <WarningIcon />
                        </>
                    }
                </BodyFileButton>
                { this.filePath && <BodyFilePath>
                    { this.filePath }
                </BodyFilePath> }
            </BodyFileContainer>

            <ConfigExplanation>
                All matching requests will receive a successful response containing the contents of the
                selected file.
            </ConfigExplanation>
            <ConfigExplanation>
                This file will be read fresh for each request, so future changes to the file will
                immediately affect matching requests.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    selectFile = async () => {
        const result = await uploadFile("path", []);
        if (result) {
            runInAction(() => {
                this.filePath = result;
            });

            this.props.onChange(
                new IpfsCatFileStep(
                    this.filePath
                )
            );
        }
    }
}

@observer
class IpfsAddResultStepConfig extends StepConfig<IpfsAddResultStep> {

    @observable
    resultPairs: PairsArray = [];

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { result } = this.props.step;

            runInAction(() => {
                this.resultPairs = result.map(({ Name, Hash }) => ({ key: Name, value: Hash }));
            });
        }));
    }

    render() {
        const { resultPairs } = this;

        return <ConfigContainer>
            <SectionLabel>IPFS Add Results</SectionLabel>

            <EditablePairs
                pairs={resultPairs}
                onChange={this.onChange}
                keyPlaceholder='Name of the added file'
                valuePlaceholder='Hash of the added file'
            />
            <ConfigExplanation>
                All matching IPFS Add calls will be intercepted, and the above results will always
                be returned directly, without forwarding the call to the real IPFS node.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChange(newPairs: PairsArray) {
        this.resultPairs = newPairs;

        this.props.onChange(
            new IpfsAddResultStep(
                this.resultPairs.map(({ key, value }) => ({ Name: key, Hash: value }))
            )
        );
    }

}

@observer
class IpnsResolveResultStepConfig extends StepConfig<IpnsResolveResultStep> {

    render() {
        return <JsonBasedStepConfig
            name='IPNS Resolve Result'
            explanation={[
                'All matching requests will be receive this data as a successful IPNS resolution.'
            ]}
            stepFactory={(data) => new IpnsResolveResultStep(data)}
            valueGetter={step => step.result}
            { ...this.props }
        />;
    }

}

@observer
class IpnsPublishResultStepConfig extends StepConfig<IpnsPublishResultStep> {

    render() {
        return <JsonBasedStepConfig
            name='IPNS Publish Result'
            explanation={[
                'All matching requests will be receive this data as a successful IPNS publish result.'
            ]}
            stepFactory={(data) => new IpnsPublishResultStep(data)}
            valueGetter={step => step.result}
            { ...this.props }
        />;
    }

}

@observer
class IpfsPinsResultStepConfig extends StepConfig<IpfsPinsResultStep> {

    render() {
        return <JsonBasedStepConfig
            name='IPFS Pinning Result'
            explanation={[
                'All matching requests will be receive this data as a successful response.'
            ]}
            stepFactory={(data) => new IpfsPinsResultStep(data)}
            valueGetter={step => step.result}
            { ...this.props }
        />;
    }

}

@observer
class IpfsPinLsResultStepConfig extends StepConfig<IpfsPinLsResultStep> {

    @observable
    resultPairs: PairsArray = [];

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { result } = this.props.step;

            runInAction(() => {
                this.resultPairs = result.map(({ Type, Cid }) => ({ key: Type, value: Cid }));
            });
        }));
    }

    render() {
        const { resultPairs } = this;

        return <ConfigContainer>
            <SectionLabel>IPFS Pin Ls Results</SectionLabel>

            <EditablePairs
                pairs={resultPairs}
                onChange={this.onChange}
                keyPlaceholder='Type of pin (recursive, direct, indirect)'
                valuePlaceholder='CID of the pinned content'
            />
            <ConfigExplanation>
                All matching IPFS Pin Ls calls will be intercepted, and the above results will always
                be returned directly, without forwarding the call to the real IPFS node.
            </ConfigExplanation>
        </ConfigContainer>;
    }

    @action.bound
    onChange(newPairs: PairsArray) {
        this.resultPairs = newPairs;

        this.props.onChange(
            new IpfsPinLsResultStep(
                this.resultPairs.map(({ key, value }) => ({ Type: key, Cid: value }))
            )
        );
    }

}

@observer
class RTCEchoStepConfig extends StepConfig<EchoStep> {

    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                Echo all sent data messages and all streamed video and audio media
                back to the intercepted peer wherever possible, until the connection is
                closed. No data will be forwarded to any connected remote peer.
            </ConfigExplanation>
            <ConfigExplanation>
                Note that in some cases echoing isn't possible - e.g. if the client opens
                a one-way video stream - in which case that data will simply be dropped.
            </ConfigExplanation>
        </ConfigContainer>;
    }

}

@observer
class RTCCloseStepConfig extends StepConfig<CloseStep> {

    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                Immediately close the WebRTC connection, with no further response and no
                data forwarded to any connected remote peer.
            </ConfigExplanation>
        </ConfigContainer>;
    }

}

@observer
class RTCWaitForMediaConfig extends StepConfig<WaitForMediaStep> {

    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                Wait until the next WebRTC media data is sent by the client.
            </ConfigExplanation>
        </ConfigContainer>
    }

}

@observer
class WaitForDurationConfig extends StepConfig<WaitForDurationStep | DelayStep> {

    @computed
    get stepDuration() {
        return 'durationMs' in this.props.step
            ? this.props.step.durationMs
            : this.props.step.delayMs;
    }

    @observable
    inputDuration: number | '' = this.stepDuration;

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            if (this.stepDuration === 0 && this.inputDuration === '') return; // Allows clearing the input, making it *implicitly* 0
            this.inputDuration = this.stepDuration;
        }));
    }

    render() {
        const { inputDuration: duration } = this;

        return <ConfigContainer>
            Wait for <TextInput
                type='number'
                min='0'
                placeholder='Duration (ms)'
                value={duration}
                onChange={this.onChange}
            /> milliseconds{
                duration !== '' && !formatDuration(duration).endsWith('ms') &&
                    ` (${ formatDuration(duration) })`
            }.
        </ConfigContainer>
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;

        const newValue = inputValue === ''
            ? ''
            : Math.max(parseInt(inputValue, 10) || 0, 0);

        if (_.isNaN(newValue)) return; // I.e. reject the edit

        this.inputDuration = newValue;

        const step = this.props.ruleType === 'webrtc'
            ? new WaitForDurationStep(newValue || 0)
            : new DelayStep(newValue || 0);
        this.props.onChange(step);
    }

}

@observer
class RTCWaitForChannelConfig extends StepConfig<WaitForChannelStep> {

    render() {
        const { channelLabel } = this.props.step;

        return <ConfigContainer>
            <SectionLabel>Channel Label</SectionLabel>
            <WideTextInput
                placeholder='The channel to wait for, or nothing to wait for any channel'
                value={channelLabel ?? ''}
                onChange={this.onChange}
            />
            <ConfigExplanation>
                Wait until the client opens a WebRTC data channel {
                    channelLabel
                        ? `with the label "${channelLabel}"`
                        : 'with any label'
                }.
            </ConfigExplanation>
        </ConfigContainer>
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;
        this.props.onChange(
            new WaitForChannelStep(inputValue || '')
        );
    }

}

@observer
class RTCWaitForDataMessageConfig extends StepConfig<WaitForMessageStep> {

    render() {
        const { channelLabel } = this.props.step;

        return <ConfigContainer>
            <SectionLabel>Channel Label</SectionLabel>
            <WideTextInput
                placeholder='The channel to watch for messages, or nothing to watch every channel'
                value={channelLabel ?? ''}
                onChange={this.onChange}
            />
            <ConfigExplanation>
                Wait until the client sends a WebRTC data message {
                    channelLabel
                        ? `on a channel with the label "${channelLabel}"`
                        : 'on any data channel'
                }.
            </ConfigExplanation>
        </ConfigContainer>
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;
        this.props.onChange(
            new WaitForMessageStep(inputValue || '')
        );
    }

}

@observer
class RTCCreateChannelStepConfig extends StepConfig<CreateChannelStep> {

    render() {
        const { channelLabel } = this.props.step;

        return <ConfigContainer>
            <SectionLabel>Channel Label</SectionLabel>
            <WideTextInput
                placeholder='A label for the channel that will be created'
                value={channelLabel}
                onChange={this.onChange}
            />
            <ConfigExplanation>
                Create a data channel on the WebRTC connection labelled "{
                    channelLabel
                }".
            </ConfigExplanation>
        </ConfigContainer>
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;
        this.props.onChange(new CreateChannelStep(inputValue));
    }

}

@observer
class RTCSendMessageStepConfig extends StepConfig<SendStep> {

    @observable
    channelLabel: string | undefined = this.props.step.channelLabel;

    @observable
    contentType: EditableContentType = 'text';

    @observable
    message = asBuffer(this.props.step.message);

    componentDidMount() {
        // If the step changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { channelLabel, message } = this.props.step;
            runInAction(() => {
                this.channelLabel = channelLabel;
                this.message = asBuffer(message);
            });
        }));
    }

    @computed
    private get textEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        return isProbablyUtf8(this.message)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const { channelLabel, message } = this;

        const messageAsString = message.toString(this.textEncoding);

        return <ConfigContainer>
            <SectionLabel>Channel Label</SectionLabel>
            <WideTextInput
                placeholder='The channel to send the message to, or nothing to send on all open channels'
                value={channelLabel ?? ''}
                onChange={this.setChannelLabel}
            />

            <BodyHeader>
                <SectionLabel>Message content</SectionLabel>
                <FormatButton
                    format={this.contentType}
                    content={message}
                    onFormatted={this.setMessage}
                />
                <ContentTypeSelect value={this.contentType} onChange={this.setContentType}>
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                </ContentTypeSelect>
            </BodyHeader>
            <BodyContainer>
                <SelfSizedEditor
                    contentId={null}
                    language={this.contentType}
                    value={messageAsString}
                    onChange={this.setMessage}
                />
            </BodyContainer>

            <ConfigExplanation>
                Send {
                    message.length === 0
                        ? 'an empty'
                        : 'the above'
                } message on {
                    channelLabel
                        ? `any open channel with the label "${channelLabel}"`
                        : 'every open data channel'
                }.
            </ConfigExplanation>
        </ConfigContainer>
    }

    @action.bound
    setContentType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.contentType = value as EditableContentType;
    }

    @action.bound
    setChannelLabel(event: React.ChangeEvent<HTMLInputElement>) {
        const inputValue = event.target.value;
        this.channelLabel = inputValue || undefined;
        this.updateStep();
    }

    @action.bound
    setMessage(message: string) {
        this.message = stringToBuffer(message, this.textEncoding);
        this.updateStep();
    }

    updateStep() {
        this.props.onChange(
            new SendStep(
                this.channelLabel,
                this.message.toString(this.textEncoding) // MockRTC currently (0.3.0) has a bug with sending buffer data
            )
        );
    }


}