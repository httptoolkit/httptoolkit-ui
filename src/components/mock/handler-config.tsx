import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';

import { styled } from '../../styles';

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
} from '../../model/rules/rule-definitions';
import { HEADER_NAME_REGEX } from '../../model/http-docs';
import {
    getDefaultMimeType,
    EditableContentType,
    getEditableContentType
} from '../../model/content-types';

import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { TextInput, Select } from '../common/inputs';
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
    }

    throw new Error('Unknown handler: ' + handler.type);
}

const SectionLabel = styled.h2`
    margin: 10px 0 5px;

    text-transform: uppercase;
    opacity: ${p => p.theme.lowlightTextOpacity};
    width: 100%;
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

    > ${Select} {
        font-size: ${p => p.theme.textSize};
        margin-top: 5px;
        width: auto;
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
                <Select value={this.contentType} onChange={this.setContentType}>
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="javascript">JavaScript</option>
                </Select>
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

const UrlInput = styled(TextInput)`
    margin-top: 5px;
    width: 100%;
    box-sizing: border-box;
`;

@observer
class ForwardToHostHandlerConfig extends HandlerConfig<ForwardToHostHandler> {

    @observable
    private error: Error | undefined;

    @observable
    private targetHost: string | undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const targetHost = this.props.handler ? this.props.handler.forwardToLocation : '';
            runInAction(() => { this.targetHost = targetHost });
        }));
    }

    render() {
        const { forwardToLocation } = this.props.handler;

        return <ConfigContainer>
            <SectionLabel>Replacement host</SectionLabel>
            <UrlInput
                value={this.targetHost || ''}
                invalid={!!this.error}
                spellCheck={false}
                onChange={this.onChange}
            />
            { forwardToLocation &&
                <ConfigExplanation>
                    All matching requests will be forwarded to {forwardToLocation},
                    keeping their existing path{
                        !forwardToLocation.includes('://') ? ', protocol,' : ''
                    } and query string.
                </ConfigExplanation>
            }
        </ConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.targetHost = event.target.value;

        try {
            if (!this.targetHost) throw new Error('A target host is required');
            this.props.onChange(new ForwardToHostHandler(this.targetHost));
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = e;
            if (this.props.onInvalidState) this.props.onInvalidState();
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