import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction, computed } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as dedent from 'dedent';

import { Headers } from '../../types';
import { css, styled } from '../../styles';
import { WarningIcon } from '../../icons';
import { uploadFile } from '../../util/ui';

import {
    Handler
} from '../../model/rules/rules';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    PassThroughHandler,
    TransformingHandler,
    RequestTransform,
    ResponseTransform,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler
} from '../../model/rules/rule-definitions';
import { HEADER_NAME_REGEX } from '../../model/http/http-docs';
import { MethodName, MethodNames } from '../../model/http/methods';
import {
    getDefaultMimeType,
    EditableContentType,
    getEditableContentType
} from '../../model/http/content-types';
import { RulesStore } from '../../model/rules/rules-store';

import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { TextInput, Select, Button } from '../common/inputs';
import { EditableHeaders } from '../common/editable-headers';
import { EditableStatus } from '../common/editable-status';
import { FormatButton } from '../common/format-button';
import { byteLength, asBuffer, isProbablyUtf8 } from '../../util';

type HandlerConfigProps<H extends Handler> = {
    handler: H;
    onChange: (handler: H) => void;
    onInvalidState: () => void;
};

abstract class HandlerConfig<
    H extends Handler,
    P extends {} = {}
> extends React.Component<HandlerConfigProps<H> & P> { }

const ConfigContainer = styled.div`
    font-size: ${p => p.theme.textSize};
`;

const ConfigExplanation = styled.p`
    font-size: ${p => p.theme.textSize};
    line-height: 1.3;
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-style: italic;
    margin-top: 10px;
`;

export function HandlerConfiguration(props: {
    handler: Handler,
    onChange: (handler: Handler) => void,
    onInvalidState?: () => void // Currently unused - intended to improve invalid entry UX later on
}) {
    const { handler, onChange, onInvalidState } = props;

    const configProps = {
        handler: handler as any,
        onChange,
        onInvalidState: onInvalidState || _.noop
    };

    if (handler instanceof StaticResponseHandler) {
        return <StaticResponseHandlerConfig {...configProps} />;
    } else if (handler instanceof FromFileResponseHandler) {
        return <FromFileResponseHandlerConfig {...configProps} />;
    } else if (handler instanceof ForwardToHostHandler) {
        return <ForwardToHostHandlerConfig {...configProps} />;
    } else if (handler instanceof PassThroughHandler) {
        return <PassThroughHandlerConfig {...configProps} />;
    } else if (handler instanceof TransformingHandler) {
        return <TransformingHandlerConfig {...configProps} />;
    } else if (handler instanceof RequestBreakpointHandler) {
        return <RequestBreakpointHandlerConfig {...configProps} />;
    } else if (handler instanceof ResponseBreakpointHandler) {
        return <ResponseBreakpointHandlerConfig {...configProps} />;
    } else if (handler instanceof RequestAndResponseBreakpointHandler) {
        return <RequestAndResponseBreakpointHandlerConfig {...configProps} />;
    } else if (handler instanceof TimeoutHandler) {
        return <TimeoutHandlerConfig {...configProps} />;
    } else if (handler instanceof CloseConnectionHandler) {
        return <CloseConnectionHandlerConfig {...configProps} />;
    }

    throw new Error('Unknown handler: ' + handler.type);
}

const SectionLabel = styled.h2`
    margin: 10px 0 5px;

    text-transform: uppercase;
    opacity: ${p => p.theme.lowlightTextOpacity};
    width: 100%;
`;

const ConfigSelect = styled(Select)`
    font-size: ${p => p.theme.textSize};
    width: auto;
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

const BodyContainer = styled.div`
    margin-top: 5px;

    > div {
        margin-top: 5px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
        padding: 1px;
    }
`;

function getHeaderValue(headers: Headers, headerName: string): string | undefined {
    const headerValue = headers[headerName];

    if (_.isArray(headerValue)) {
        return headerValue[0];
    } else {
        return headerValue;
    }
}

@observer
class StaticResponseHandlerConfig extends React.Component<HandlerConfigProps<StaticResponseHandler>> {

    @observable
    statusCode: number | undefined = this.props.handler.status;

    @observable
    statusMessage = this.props.handler.statusMessage;

    @observable
    headers = this.props.handler.headers || {};

    @observable
    contentType: EditableContentType = 'text';

    @observable
    body = asBuffer(this.props.handler.data);

    componentDidMount() {
        // If any of our data fields change, rebuild & update the handler
        disposeOnUnmount(this, reaction(() => (
            JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'body']))
        ), () => this.updateHandler()));

        // If the handler changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { status, statusMessage, headers, data } = this.props.handler;
            runInAction(() => {
                this.statusCode = status;
                this.statusMessage = statusMessage;
                this.headers = headers || {};
                this.body = asBuffer(data);
            });
        }));

        // If you enter a relevant content-type header, consider updating the editor content type:
        disposeOnUnmount(this, autorun(() => {
            const detectedContentType = getEditableContentType(getHeaderValue(this.headers, 'content-type'));
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
            const contentTypeHeader = getHeaderValue(this.headers, 'content-type');

            if (!contentTypeHeader) {
                // If you pick a body content type with no header set, we add one
                runInAction(() => {
                    this.headers['content-type'] = getDefaultMimeType(newContentType);
                });
            } else {
                const headerContentType = getEditableContentType(contentTypeHeader);

                // If the body type changes, and the old header matched the old type, update the header
                if (previousContentType === headerContentType) {
                    runInAction(() => {
                        this.headers['content-type'] = getDefaultMimeType(newContentType);
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
            const lengthHeader = getHeaderValue(this.headers, 'content-length');

            if (!lengthHeader) return;

            if (parseInt(lengthHeader || '', 10) === byteLength(previousBody)) {
                runInAction(() => {
                    // If the content-length was previously correct, keep it correct:
                    this.headers['content-length'] = byteLength(newBody).toString();
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
        const { statusCode, statusMessage, headers, body } = this;

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
            <EditableHeaders
                headers={headers}
                onChange={this.onHeadersChanged}
            />

            <BodyHeader>
                <SectionLabel>Response body</SectionLabel>
                <FormatButton
                    format={this.contentType}
                    content={body}
                    onFormatted={this.setBody}
                />
                <ConfigSelect value={this.contentType} onChange={this.setContentType}>
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="javascript">JavaScript</option>
                </ConfigSelect>
            </BodyHeader>
            <BodyContainer>
                <ThemedSelfSizedEditor
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
    onHeadersChanged(headers: Headers) {
        this.headers = headers;
    }

    @action.bound
    setContentType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.contentType = value as EditableContentType;
    }

    @action.bound
    setBody(body: string) {
        this.body = Buffer.from(body, this.textEncoding);
    }

    updateHandler() {
        if (
            !this.statusCode ||
            this.statusCode < 100 ||
            this.statusCode >= 1000 ||
            _.some(Object.keys(this.headers), (key) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new StaticResponseHandler(
                this.statusCode,
                this.statusMessage,
                this.body,
                this.headers
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
class FromFileResponseHandlerConfig extends React.Component<HandlerConfigProps<FromFileResponseHandler>> {

    @observable
    statusCode: number | undefined = this.props.handler.status;

    @observable
    statusMessage = this.props.handler.statusMessage;

    // Headers, as an array of { key, value }, with multiple values flattened.
    @observable
    headers = this.props.handler.headers || {};

    @observable
    filePath = (this.props.handler.filePath || '').toString();

    componentDidMount() {
        // If any of our data fields change, rebuild & update the handler
        disposeOnUnmount(this, reaction(() => (
            JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'filePath']))
        ), () => this.updateHandler()));

        // If the handler changes (or when its set initially), update our data fields
        disposeOnUnmount(this, autorun(() => {
            const { status, statusMessage, headers, filePath } = this.props.handler;
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

    updateHandler() {
        if (
            !this.statusCode ||
            this.statusCode < 100 ||
            this.statusCode >= 1000 ||
            _.some(Object.keys(this.headers), (key) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new FromFileResponseHandler(
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
class ForwardToHostHandlerConfig extends HandlerConfig<ForwardToHostHandler, {
    rulesStore?: RulesStore
}> {

    @observable
    private error: Error | undefined;

    @observable
    private targetHost: string | undefined;

    @observable
    private updateHostHeader: true | false = true;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const targetHost = this.props.handler ? this.props.handler.forwarding!.targetHost : '';
            const updateHostHeader = this.props.handler ? this.props.handler.forwarding!.updateHostHeader : true;
            runInAction(() => {
                this.targetHost = targetHost
                this.updateHostHeader = !!updateHostHeader;
            });
        }));
    }

    render() {
        const { targetHost, updateHostHeader, error, onTargetChange, onUpdateHeaderChange } = this;
        const { targetHost: savedTargetHost } = this.props.handler.forwarding!;

        return <ConfigContainer>
            <SectionLabel>Replacement host</SectionLabel>
            <UrlInput
                value={targetHost || ''}
                invalid={!!error}
                spellCheck={false}
                onChange={onTargetChange}
            />

            <SectionLabel>Host header</SectionLabel>
            <ConfigSelect
                value={updateHostHeader.toString()}
                onChange={onUpdateHeaderChange}
                title={dedent`
                    Most servers will not accept requests that arrive
                    with the wrong host header, so it's typically useful
                    to automatically change it to match the new host
                `}
            >
                <option value={'true'}>Update the host header automatically (recommended)</option>
                <option value={'false'}>Leave the host header untouched</option>
            </ConfigSelect>
            { savedTargetHost &&
                <ConfigExplanation>
                    All matching requests will be forwarded to {savedTargetHost},
                    keeping their existing path{
                        !savedTargetHost.includes('://') ? ', protocol,' : ''
                    } and query string.{
                        updateHostHeader
                        ? ' Their host header will be automatically updated to match.'
                        : ''
                    }
                </ConfigExplanation>
            }
        </ConfigContainer>;
    }

    updateHandler() {
        try {
            if (!this.targetHost) throw new Error('A target host is required');

            const protocolMatch = this.targetHost.match(/^\w+:\/\//);
            if (protocolMatch) {
                const pathWithoutProtocol = this.targetHost.slice(protocolMatch[0].length);

                if (pathWithoutProtocol.includes('/')) {
                    throw new Error('The replacement host shouldn\'t include a path, since it won\'t be used');
                }
                if (pathWithoutProtocol.includes('?')) {
                    throw new Error('The replacement host shouldn\'t include a query string, since it won\'t be used');
                }
            } else {
                if (this.targetHost.includes('/')) {
                    throw new Error('The replacement host shouldn\'t include a path, since it won\'t be used');
                }
                if (this.targetHost.includes('?')) {
                    throw new Error('The replacement host shouldn\'t include a query string, since it won\'t be used');
                }
            }

            this.props.onChange(new ForwardToHostHandler(this.targetHost, this.updateHostHeader, this.props.rulesStore!));
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = e;
            if (this.props.onInvalidState) this.props.onInvalidState();
            throw e;
        }
    }

    @action.bound
    onTargetChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.targetHost = event.target.value;

        try {
            this.updateHandler();
            event.target.setCustomValidity('');
        } catch (e) {
            event.target.setCustomValidity(e.message);
        }
        event.target.reportValidity();
    }

    @action.bound
    onUpdateHeaderChange(event: React.ChangeEvent<HTMLSelectElement>) {
        this.updateHostHeader = event.target.value === 'true';

        try {
            this.updateHandler();
        } catch (e) {
            // If there's an error, it must be in the host name, so it's reported elsewhere
        }
    }
}

const TransformSectionLabel = styled(SectionLabel)`
    margin-top: 20px;
`;

const TransformSectionSeparator = styled.hr`
    width: 100%;
    box-sizing: border-box;
    margin: 20px 0;
    border: solid 1px ${p => p.theme.containerWatermark};
`;

const TransformConfig = styled.div`
    margin: 0 0 5px;

    ${(p: { active: boolean }) => p.active && css`
        border-left: solid 5px ${p => p.theme.containerWatermark};

        &:focus-within {
            border-left: solid 5px ${p => p.theme.primaryInputBackground};
        }

        padding-left: 5px;
        margin: 10px 0 15px;
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
`

@inject('rulesStore')
@observer
class TransformingHandlerConfig extends React.Component<HandlerConfigProps<TransformingHandler> & {
    rulesStore?: RulesStore
}> {

    @observable
    transformRequest = this.props.handler.transformRequest || {};

    @observable
    transformResponse = this.props.handler.transformResponse || {};

    render() {
        return <ConfigContainer>
            <TransformSectionLabel>Request Transforms:</TransformSectionLabel>
            <MethodTransformConfig
                replacementMethod={this.transformRequest?.replaceMethod}
                onChange={this.transformField('transformRequest')('replaceMethod')}
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

            this.updateHandler();
        }
    );

    updateHandler() {
        this.props.onChange(new TransformingHandler(
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
            <option value='none'>Pass through the real request method</option>
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

const StatusTransformConfig = (props: {
    replacementStatus: number | undefined,
    onChange: (status: number | undefined) => void
}) => {
    const selected = props.replacementStatus !== undefined
        ? 'replace'
        : 'none';

    return <TransformConfig active={selected !== 'none'}>
        <SelectTransform
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
            <option value='none'>Pass through the real response status</option>
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

    render() {
        const { type, transform } = this.props;
        const {
            selected,
            convertHeaderResult,
            onTransformTypeChange,
            setHeadersValue
        } = this;

        return <TransformConfig active={selected !== 'none'}>
            <SelectTransform
                value={selected}
                onChange={onTransformTypeChange}
            >
                <option value='none'>Pass through the real { type } headers</option>
                <option value='updateHeaders'>Update the { type } headers</option>
                <option value='replaceHeaders'>Replace the { type } headers</option>
            </SelectTransform>
            {
                selected !== 'none' && <TransformDetails>
                    <EditableHeaders
                        headers={transform[selected] || {}}
                        convertResult={convertHeaderResult}
                        onChange={setHeadersValue}
                        allowEmptyValues={selected === 'updateHeaders'}
                    />
                </TransformDetails>
            }
        </TransformConfig>;
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

    convertHeaderResult = (headers: Headers) => {
        if (this.selected === 'updateHeaders') {
            return _.mapValues(headers, (header) => header === '' ? undefined : header);
        } else {
            return headers;
        }
    };

    @action.bound
    setHeadersValue(value: Headers) {
        this.clearValues();
        if (this.selected !== 'none') {
            this.props.onChange(this.selected)(value);
        }
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
        'updateJsonBody'
    ] as const;

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
            setJsonBodyUpdate
        } = this;

        const selected = _.find(BodyTransformConfig.FIELDS, (field) =>
            transform[field] !== undefined
        ) ?? 'none';

        return <TransformConfig active={selected !== 'none'}>
            <SelectTransform
                value={selected}
                onChange={onTransformTypeChange}>
                <option value='none'>Pass through the real { type } body</option>
                <option value='replaceBody'>Replace the { type } body with a fixed value</option>
                <option value='replaceBodyFromFile'>Replace the { type } body with a file</option>
                <option value='updateJsonBody'>Update values within a JSON { type } body</option>
            </SelectTransform>
            {
                selected === 'replaceBody'
                    ? <RawBodyTransfomConfig
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
                : null
            }
        </TransformConfig>;
    }

    onTransformTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value as 'none' | typeof BodyTransformConfig.FIELDS[number];

        this.clearValues();
        if (value === 'updateJsonBody') {
            this.props.onChange('updateJsonBody')({});
        } else if (value === 'replaceBody') {
            this.props.onChange('replaceBody')('');
        } else if (value === 'replaceBodyFromFile') {
            this.props.onChange('replaceBodyFromFile')('');
        }
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
};

const RawBodyTransfomConfig = (props: {
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
            <ConfigSelect value={contentType} onChange={onContentTypeChanged}>
                <option value="text">Plain text</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="javascript">JavaScript</option>
            </ConfigSelect>
        </BodyHeader>
        <BodyContainer>
            <ThemedSelfSizedEditor
                language={contentType}
                value={props.body.toString('utf8')}
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
            setError(e);
        }
    }, [bodyString]);

    return <TransformDetails>
        <BodyHeader>
            <SectionLabel>JSON { props.type } body patch</SectionLabel>
            { error && <WarningIcon title={error.message} /> }

            <StandaloneFormatButton
                format='json'
                content={asBuffer(bodyString)}
                onFormatted={setBodyString}
            />
        </BodyHeader>
        <BodyContainer>
            <ThemedSelfSizedEditor
                language='json'
                value={bodyString}
                onChange={(content) => setBodyString(content)}
            />
        </BodyContainer>
    </TransformDetails>;
};

@observer
class PassThroughHandlerConfig extends HandlerConfig<PassThroughHandler> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will be transparently passed through to the upstream target host.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class RequestBreakpointHandlerConfig extends HandlerConfig<RequestBreakpointHandler> {
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
class ResponseBreakpointHandlerConfig extends HandlerConfig<ResponseBreakpointHandler> {
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
class RequestAndResponseBreakpointHandlerConfig extends HandlerConfig<RequestAndResponseBreakpointHandler> {
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
class TimeoutHandlerConfig extends HandlerConfig<TimeoutHandler> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                When a matching request is received, the server will keep the connection
                open but do nothing. With no data or response, most clients will time out
                and abort the request after sufficient time has passed.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class CloseConnectionHandlerConfig extends HandlerConfig<CloseConnectionHandler> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                As soon as a matching request is received, the connection will
                be closed, with no response.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}