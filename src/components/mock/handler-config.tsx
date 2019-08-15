import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, autorun, observe, runInAction } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';

import { Headers } from '../../types';
import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';

import {
    Handler
} from '../../model/rules/rules';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    PassThroughHandler
} from '../../model/rules/rule-definitions';
import { getStatusMessage } from '../../model/http-docs';
import { getHTKContentType, getDefaultMimeType } from '../../model/content-types';

import { clickOnEnter } from '../component-utils';
import { SelfSizedBaseEditor } from '../editor/base-editor';
import { TextInput, Select, Button } from '../common/inputs';

type HandlerConfigProps<h extends Handler> = {
    handler: h;
    onChange: (handler: h) => void;
    onInvalidState?: () => void;
};

const ConfigContainer = styled.div`
    margin-bottom: 5px;
    font-size: ${p => p.theme.textSize};
`;

const ConfigExplanation = styled.p`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-style: italic;
    margin-top: 5px;
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
        onInvalidState
    };

    if (handler instanceof StaticResponseHandler) {
        return <StaticResponseHandlerConfig {...configProps} />;
    } else if (handler instanceof ForwardToHostHandler) {
        return <ForwardToHostHandlerConfig {...configProps} />;
    } else if (handler instanceof PassThroughHandler) {
        return <PassThroughHandlerConfig {...configProps} />;
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
                    max='599'
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
                    <TextInput value={key} key={`${i}-key`} onChange={(e) => this.updateHeaderName(i, e)} />,
                    <TextInput value={value} key={`${i}-val`} onChange={(e) => this.updateHeaderValue(i, e)}  />,
                    <HeaderDeleteButton key={`${i}-del`} onClick={() => this.deleteHeader(i)} onKeyPress={clickOnEnter}>
                        <FontAwesomeIcon icon={['far', 'trash-alt']} />
                    </HeaderDeleteButton>
                ]).concat([
                    <TextInput
                        value=''
                        placeholder='Header name'
                        key={`${headers.length}-key`}
                        onChange={this.addHeaderByName}
                    />,
                    <TextInput
                        value=''
                        placeholder='Header value'
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
                <SelfSizedBaseEditor
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
        this.headers.splice(index);
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
        if (_.isNaN(statusCode)) return;

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
    width: 100%;
    box-sizing: border-box;
`;

@observer
class ForwardToHostHandlerConfig extends React.Component<HandlerConfigProps<ForwardToHostHandler>> {
    render() {
        return <ConfigContainer>
            <UrlInput
                value={this.props.handler.forwardToLocation}
                onChange={(event) => {
                    const handler = new ForwardToHostHandler(event.target.value);
                    this.props.onChange(handler);
                }}
            />
            <ConfigExplanation>
                All matching requests will be forwarded to {this.props.handler.forwardToLocation},
                retaining their existing path and query string.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class PassThroughHandlerConfig extends React.Component<HandlerConfigProps<PassThroughHandler>> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will be passed through to the upstream target host.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}