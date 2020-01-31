import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as dedent from 'dedent';

import { styled } from '../../styles';
import { WarningIcon } from '../../icons';
import { uploadFile } from '../../util/ui';

import {
    Handler
} from '../../model/rules/rules';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    PassThroughHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler
} from '../../model/rules/rule-definitions';
import { HEADER_NAME_REGEX } from '../../model/http/http-docs';
import {
    getDefaultMimeType,
    EditableContentType,
    getEditableContentType
} from '../../model/http/content-types';
import { RulesStore } from '../../model/rules/rules-store';

import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { TextInput, Select, Button } from '../common/inputs';
import {
    EditableHeaders,
    HeadersArray,
    headersToHeadersArray,
    headersArrayToHeaders
} from '../common/editable-headers';
import { EditableStatus } from '../common/editable-status';

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
    margin-bottom: 5px;
    font-size: ${p => p.theme.textSize};
`;

const ConfigExplanation = styled.p`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-style: italic;
    margin-top: 10px;
`;

export function HandlerConfiguration(props: {
        handler: Handler,
        onChange: (handler: Handler) => void,
        onInvalidState?: () => void
    }
) {
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
    margin-top: 5px;
    width: auto;
`;

const BodyHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-end;

    margin-bottom: 5px;

    > ${SectionLabel} {
        flex-grow: 1;
        margin-bottom: 0;
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

function getContentTypeHeader(headers: Array<[string, string]>): [string, string] | undefined {
    return (_.find(headers, ([key]) => key.toLowerCase() === 'content-type'));
}

function getContentTypeFromHeader(contentTypeHeader: string | undefined | [string, string]): EditableContentType | undefined {
    const contentTypeValue = _.isArray(contentTypeHeader)
        ? contentTypeHeader[1]
        : contentTypeHeader;
    return getEditableContentType(contentTypeValue);
}

@observer
class StaticResponseHandlerConfig extends React.Component<HandlerConfigProps<StaticResponseHandler>> {

    @observable
    statusCode: number | '' = this.props.handler.status;

    @observable
    statusMessage = this.props.handler.statusMessage;

    // Headers, as an array of [k, v], with multiple values flattened.
    @observable
    headers = headersToHeadersArray(this.props.handler.headers || {});

    @observable
    contentType: EditableContentType = 'text';

    @observable
    body = (this.props.handler.data || '').toString();

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
                this.headers = headersToHeadersArray(headers || {});
                this.body = (data || '').toString();
            });
        }));

        // If you enter a relevant content-type header, consider updating the editor content type:
        disposeOnUnmount(this, autorun(() => {
            const detectedContentType = getContentTypeFromHeader(getContentTypeHeader(this.headers));
            if (detectedContentType) runInAction(() => {
                this.contentType = detectedContentType;
            });
            // If not a known type, we leave the content type as whatever it currently is
        }));

        // If you set the editor content type, keep the content-type header up to date
        disposeOnUnmount(this, observe(this, 'contentType', ({
            oldValue: oldContentType,
            newValue: newContentType
        }) => {
            const contentTypeHeader = getContentTypeHeader(this.headers);

            if (!contentTypeHeader) {
                // If you pick a body content type with no header set, we add one
                runInAction(() => {
                    this.headers.push(['Content-Type', getDefaultMimeType(newContentType)]);
                });
            } else {
                const headerContentType = getContentTypeFromHeader(contentTypeHeader);

                // If the body type changes, and the old header matched the old type, update the header
                if (oldContentType === headerContentType) {
                    runInAction(() => {
                        contentTypeHeader[1] = getDefaultMimeType(newContentType);
                    });
                }
                // If there is a header, but it didn't match the body, leave it as-is
            }
        }));
    }

    render() {
        const { statusCode, statusMessage, headers, body } = this;

        return <ConfigContainer>
            <SectionLabel>Status</SectionLabel>
            <EditableStatus
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
                    value={body}
                    onChange={this.setBody}
                />
            </BodyContainer>
        </ConfigContainer>;
    }

    @action.bound
    setStatus(statusCode: number | '', statusMessage: string | undefined) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
    }

    @action.bound
    onHeadersChanged(headers: HeadersArray) {
        this.headers = headers;
    }

    @action.bound
    setContentType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.contentType = value as EditableContentType;
    }

    @action.bound
    setBody(body: string) {
        this.body = body;
    }

    updateHandler() {
        if (
            !this.statusCode ||
            this.statusCode < 100 ||
            this.statusCode >= 1000 ||
            _.some(this.headers, ([key]) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new StaticResponseHandler(
                this.statusCode,
                this.statusMessage,
                this.body,
                headersArrayToHeaders(this.headers)
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
    statusCode: number | '' = this.props.handler.status;

    @observable
    statusMessage = this.props.handler.statusMessage;

    // Headers, as an array of [k, v], with multiple values flattened.
    @observable
    headers = headersToHeadersArray(this.props.handler.headers || {});

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
                this.headers = headersToHeadersArray(headers || {});
                this.filePath = filePath;
            });
        }));
    }

    render() {
        const { statusCode, statusMessage, headers } = this;

        return <ConfigContainer>
            <SectionLabel>Status</SectionLabel>
            <EditableStatus
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
    setStatus(statusCode: number | '', statusMessage: string | undefined) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
    }

    @action.bound
    onHeadersChanged(headers: HeadersArray) {
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
            _.some(this.headers, ([key]) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new FromFileResponseHandler(
                this.statusCode,
                this.statusMessage,
                this.filePath,
                headersArrayToHeaders(this.headers)
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