import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction, when, flow } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import { Location } from '@reach/router';

import { Headers } from '../../types';
import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';

import {
    Handler
} from '../../model/rules/rules';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    PassThroughHandler,
    BreakpointHandler
} from '../../model/rules/rule-definitions';
import { getStatusMessage, HEADER_NAME_PATTERN, HEADER_NAME_REGEX } from '../../model/http-docs';
import { getHTKContentType, getDefaultMimeType } from '../../model/content-types';
import { InterceptionStore } from '../../model/interception-store';
import { HttpExchange } from '../../model/exchange';

import { clickOnEnter } from '../component-utils';
import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { TextInput, Select, Button } from '../common/inputs';

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
    } else if (handler instanceof BreakpointHandler) {
        return <Location>{({ navigate }) =>
            <BreakpointHandlerConfig navigate={navigate} {...configProps} />
        }</Location>;
    }

    throw new Error('Unknown handler: ' + handler.type);
}

const SectionLabel = styled.h2`
    margin-top: 10px;

    text-transform: uppercase;
    opacity: ${p => p.theme.lowlightTextOpacity};
    width: 100%;
`;

const StatusContainer = styled.div`
    margin-top: 5px;

    display: flex;
    flex-direction: row;
    align-items: stretch;

    > :not(:last-child) {
        margin-right: 5px;
    }

    > :last-child {
        flex-grow: 1;
    }
`;

const HeadersContainer = styled.div`
    margin-top: 5px;

    display: grid;
    grid-gap: 5px;
    grid-template-columns: 1fr 2fr auto;

    > :last-child {
        grid-column: 2 / span 2;
    }
`;

const HeaderDeleteButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 3px 10px 5px;
`;

const BodyHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-end;

    > ${SectionLabel} {
        flex-grow: 1;
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

// Subset of HtkContentType that we support in this editor
const EditorContentTypes = [
    'text',
    'json',
    'xml',
    'html',
    'css',
    'javascript'
] as const;

type EditorContentType = (typeof EditorContentTypes) extends ReadonlyArray<infer T> ? T : never;

function getContentTypeHeader(headers: Array<[string, string]>): [string, string] | undefined {
    return (_.find(headers, ([key]) => key.toLowerCase() === 'content-type'));
}

function getEditorContentType(contentTypeHeader: string | undefined | [string, string]): EditorContentType | undefined {
    const contentTypeValue = _.isArray(contentTypeHeader) ? contentTypeHeader[1] : contentTypeHeader;
    const htkContentType = getHTKContentType(contentTypeValue);

    if ((EditorContentTypes as ReadonlyArray<any>).includes(htkContentType)) {
        return htkContentType as EditorContentType;
    }
}

@observer
class StaticResponseHandlerConfig extends React.Component<HandlerConfigProps<StaticResponseHandler>> {

    @observable
    statusCode = this.props.handler.status.toString();

    @observable
    statusMessage = this.props.handler.statusMessage;

    // Headers, as an array of [k, v], with multiple values flattened.
    @observable
    headers = Object.entries(this.props.handler.headers || {}).reduce(
        (acc: Array<[string, string]>, [key, value]) => {
            if (_.isArray(value)) {
                acc = acc.concat(value.map(v => [key, v]))
            } else {
                acc.push([key, value || '']);
            }
            return acc;
        }, []
    );

    @observable
    bodyLanguage: EditorContentType = 'text';

    @observable
    body = (this.props.handler.data || '').toString();

    componentDidMount() {
        // If any of our data fields change, rebuild & update the handler
        disposeOnUnmount(this, reaction(() => (
            JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'body']))
        ), () => this.updateHandler()));

        // If you enter a relevant content-type header, consider updating the editor language:
        disposeOnUnmount(this, autorun(() => {
            const detectedContentType = getEditorContentType(getContentTypeHeader(this.headers));
            if (detectedContentType) runInAction(() => {
                this.bodyLanguage = detectedContentType;
            });
            // If not a known type, we leave the language as whatever it currently is
        }));

        // If you set the editor language, keep the content-type header up to date
        disposeOnUnmount(this, observe(this, 'bodyLanguage', ({
            oldValue: oldLanguage,
            newValue: newLanguage
        }) => {
            const contentTypeHeader = getContentTypeHeader(this.headers);

            if (!contentTypeHeader) {
                // If you pick a body language with no header set, we add one
                runInAction(() => {
                    this.headers.push(['Content-Type', getDefaultMimeType(newLanguage)]);
                });
            } else {
                const headerContentType = getEditorContentType(contentTypeHeader);

                // If the body type changes, and the old header matched the old type, update the header
                if (oldLanguage === headerContentType) {
                    runInAction(() => {
                        contentTypeHeader[1] = getDefaultMimeType(newLanguage);
                    });
                }
                // If there is a header, but it didn't match the body, leave it as-is
            }
        }));
    }

    render() {
        const { statusCode, headers, body } = this;

        // Undefined status message = use default. Note that the status
        // message can still be shown as _empty_, just not undefined.
        const statusMessage = this.statusMessage === undefined
            ? getStatusMessage(statusCode)
            : this.statusMessage;

        return <ConfigContainer>
            <SectionLabel>Status</SectionLabel>
            <StatusContainer>
                <TextInput
                    type='number'
                    min='100'
                    max='999'
                    invalid={_.isNaN(parseInt(statusCode, 10))}
                    value={statusCode}
                    onChange={this.setStatus}
                />

                <TextInput
                    value={statusMessage}
                    onChange={this.setStatusMessage}
                />
            </StatusContainer>

            <SectionLabel>Headers</SectionLabel>
            <HeadersContainer>
                { _.flatMap(headers, ([key, value], i) => [
                    <TextInput
                        value={key}
                        required
                        pattern={HEADER_NAME_PATTERN}
                        spellCheck={false}
                        key={`${i}-key`}
                        onChange={(e) => this.updateHeaderName(i, e)}
                    />,
                    <TextInput
                        value={value}
                        invalid={!value}
                        spellCheck={false}
                        key={`${i}-val`}
                        onChange={(e) => this.updateHeaderValue(i, e)}
                    />,
                    <HeaderDeleteButton
                        key={`${i}-del`}
                        onClick={() => this.deleteHeader(i)}
                        onKeyPress={clickOnEnter}
                    >
                        <FontAwesomeIcon icon={['far', 'trash-alt']} />
                    </HeaderDeleteButton>
                ]).concat([
                    <TextInput
                        value=''
                        pattern={HEADER_NAME_PATTERN}
                        placeholder='Header name'
                        spellCheck={false}
                        key={`${headers.length}-key`}
                        onChange={this.addHeaderByName}
                    />,
                    <TextInput
                        value=''
                        placeholder='Header value'
                        spellCheck={false}
                        key={`${headers.length}-val`}
                        onChange={this.addHeaderByValue}
                    />
                ]) }
            </HeadersContainer>

            <BodyHeader>
                <SectionLabel>Response body</SectionLabel>
                <Select value={this.bodyLanguage} onChange={this.setBodyLanguage}>
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
                    language={this.bodyLanguage}
                    value={body}
                    onChange={this.setBody}
                />
            </BodyContainer>
        </ConfigContainer>;
    }

    @action.bound
    setStatus(event: React.ChangeEvent<HTMLInputElement>) {
        this.statusCode = event.target.value;

        // Empty status messages reset to default when the status is changed:
        if (this.statusMessage === '') this.statusMessage = undefined;
    }

    @action.bound
    setStatusMessage(event: React.ChangeEvent<HTMLInputElement>) {
        const message = event.target.value;

        if (message !== getStatusMessage(this.statusCode)) {
            this.statusMessage = message;
        } else {
            this.statusMessage = undefined;
        }
    }

    @action.bound
    addHeaderByName(event: React.ChangeEvent<HTMLInputElement>) {
        const name = event.target.value;
        this.headers.push([name, '']);
    }

    @action.bound
    addHeaderByValue(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        this.headers.push(['', value]);
    }

    @action.bound
    updateHeaderName(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const name = event.target.value;
        this.headers[index][0] = name;
    }

    @action.bound
    updateHeaderValue(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        this.headers[index][1] = value;
    }

    @action.bound
    deleteHeader(index: number) {
        this.headers.splice(index, 1);
    }

    @action.bound
    setBodyLanguage(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value;
        this.bodyLanguage = value as EditorContentType;
    }

    @action.bound
    setBody(body: string) {
        this.body = body;
    }

    updateHandler() {
        const statusCode = parseInt(this.statusCode, 10);

        if (
            _.isNaN(statusCode) ||
            statusCode < 100 ||
            statusCode >= 1000 ||
            _.some(this.headers, ([key]) => !key.match(HEADER_NAME_REGEX))
        ) return this.props.onInvalidState();

        this.props.onChange(
            new StaticResponseHandler(
                statusCode,
                this.statusMessage,
                this.body,
                _.fromPairs(this.headers) as Headers
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

    // Only read once on creation: we trust the parent to set/reset a key prop
    // if this is going to change externally.
    @observable
    private targetHost = this.props.handler ? this.props.handler.forwardToLocation : '';

    render() {
        const { forwardToLocation } = this.props.handler;

        return <ConfigContainer>
            <SectionLabel>Replacement host</SectionLabel>
            <UrlInput
                value={this.targetHost}
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

const BreakpointToggleContainer = styled.div`
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    margin: 20px 0;
`;

const BreakpointToggle = styled.input.attrs({
    type: 'checkbox'
})`
    width: 20px;
    height: 20px;
    margin-right: 10px;
`;

const BreakpointLabel = styled.label`
`;

@inject('interceptionStore')
@observer
class BreakpointHandlerConfig extends HandlerConfig<PassThroughHandler, {
    navigate: (url: string) => void,
    interceptionStore?: InterceptionStore
}> {

    requestToggleId = _.uniqueId();
    responseToggleId = _.uniqueId();

    @observable
    requestBreakpointEnabled = !!this.props.handler.beforeRequest;

    @observable
    responseBreakpointEnabled = !!this.props.handler.beforeResponse;

    render() {
        const { requestBreakpointEnabled, responseBreakpointEnabled } = this;

        return <ConfigContainer>
            <BreakpointToggleContainer>
                <BreakpointToggle
                    id={this.requestToggleId}
                    checked={requestBreakpointEnabled}
                    onChange={this.onChange}
                />
                <BreakpointLabel htmlFor={this.requestToggleId}>
                    Pause requests for editing before forwarding them upstream
                </BreakpointLabel>

                <BreakpointToggle
                    id={this.responseToggleId}
                    checked={responseBreakpointEnabled}
                    onChange={this.onChange}
                />
                <BreakpointLabel htmlFor={this.responseToggleId}>
                    Pause responses for editing before returning them to the client
                </BreakpointLabel>
            </BreakpointToggleContainer>
            <ConfigExplanation>
                All matching traffic will {
                    (requestBreakpointEnabled && responseBreakpointEnabled)
                        ? <>
                            breakpoint when a request is sent or a response is received, allowing
                            you to edit the URL (to transparently redirect the request elsewhere),
                            method, headers, or body before they are sent upstream, and also rewrite
                            the status code, headers or body, before it is returned to the
                            initiating client.
                        </>
                    : requestBreakpointEnabled
                        ? <>
                            hit a breakpoint when the request is sent, allowing you to edit the
                            URL (to transparently redirect the request elsewhere), method, headers
                            or body, before they are sent upstream.
                        </>
                    : responseBreakpointEnabled
                        ? <>
                            breakpoint when the response is received from the upstream server,
                            allowing you to rewrite the status code, headers, or body, before it
                            is returned to the client of the original request.
                        </>
                    : 'be transparently passed through to the upstream target host.'
                }
            </ConfigExplanation>
        </ConfigContainer>;
    }

    private breakpointExchange = flow(function * (
        this: BreakpointHandlerConfig,
        type: 'request' | 'response',
        eventId: string
    ) {
        let exchange: HttpExchange | undefined;

        // Wait until the event itself has arrived in the UI:
        yield when(() => {
            exchange = _.find(this.props.interceptionStore!.exchanges, { id: eventId });
            return !!exchange;
        });

        // Jump to the exchange:
        this.props.navigate(`/view/${eventId}`);

        // Mark the exchange as breakpointed
        // UI will make it editable, add a save button, save will resolve this promise
        const editedExchange = yield (
            type === 'request'
                ? exchange!.triggerRequestBreakpoint()
                : exchange!.triggerResponseBreakpoint()
        );

        return editedExchange;
    });

    private breakpointRequest = (request: { id: string }) => this.breakpointExchange('request', request.id);
    private breakpointResponse = (response: { id: string }) => this.breakpointExchange('response', response.id)

    @action.bound
    onChange(changeEvent: React.ChangeEvent<HTMLInputElement>) {
        if (changeEvent.target.id === this.requestToggleId) {
            this.requestBreakpointEnabled = !this.requestBreakpointEnabled;
        } else if (changeEvent.target.id === this.responseToggleId) {
            this.responseBreakpointEnabled = !this.responseBreakpointEnabled;
        }

        this.props.onChange(new BreakpointHandler({
            beforeRequest: this.requestBreakpointEnabled ? this.breakpointRequest : undefined,
            beforeResponse: this.responseBreakpointEnabled ? this.breakpointResponse : undefined
        }));
    }
}