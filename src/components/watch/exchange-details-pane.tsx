import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, autorun, IObservableValue } from 'mobx';

import { CompletedRequest, CompletedResponse } from '../../types';
import { styled, css } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { HttpExchange } from '../../model/store';
import { HtkContentType } from '../../content-types';
import { getExchangeSummaryColour, getStatusColor } from '../../exchange-colors';
import { decodeContent } from '../../worker/worker-api';

import { Pill } from '../common/pill';
import { CollapsibleCard, CollapseIcon } from '../common/card'
import { EmptyState } from '../common/empty-state';
import { HeaderDetails } from './header-details';
import { ContentTypeSelector } from '../editor/content-type-selector';
import { ContentEditor } from '../editor/content-editor';

function hasCompletedBody(res: CompletedResponse): res is CompletedResponse {
    return !!get(res, 'body', 'buffer');
}

function getReadableSize(bytes: number, siUnits = true) {
    let thresh = siUnits ? 1000 : 1024;

    let units = siUnits
        ? ['bytes', 'kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['bytes', 'KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

    let unitIndex = bytes === 0 ? 0 :
        Math.floor(Math.log(bytes) / Math.log(thresh));

    let unitName = bytes === 1 ? 'byte' : units[unitIndex];

    return (bytes / Math.pow(thresh, unitIndex)).toFixed(1).replace(/\.0$/, '') + ' ' + unitName;
}

const ExchangeDetailsContainer = styled.div`
    position: relative;
    overflow-y: auto;

    height: 100%;
    width: 100%;
    box-sizing: border-box;

    background-color: ${p => p.theme.containerBackground};
`;

// Bit of redundancy here, but just because the TS styled plugin
// gets super confused if you use variables in property names.
const cardDirectionCss = (direction: string) => direction === 'right' ? css`
    padding-right: 15px;
    border-right: solid 5px ${p => p.theme.containerBorder};
` : css`
    padding-left: 15px;
    border-left: solid 5px ${p => p.theme.containerBorder};
`;

const Card = styled(CollapsibleCard)`
    margin: 20px;
    word-break: break-all;

    ${(p: { direction: 'left' | 'right' }) => cardDirectionCss(p.direction)};

    &:focus {
        ${CollapseIcon} {
            color: ${p => p.theme.popColor};
        }
    }

    &:focus-within {
        header h1 {
            color: ${p => p.theme.popColor};
        }

        outline: none;
        border-color: ${p => p.theme.popColor};
    }
`;

const CardContent = styled.div<{ height?: string }>`
    ${p => p.height && css`
        height: ${p.height};
    `}

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const ContentLabel = styled.div`
    text-transform: uppercase;
    opacity: 0.5;

    margin-bottom: 10px;
    width: 100%;

    &:not(:first-child) {
        margin-top: 10px;
    }
`;

const ContentValue = styled.div`
    font-family: 'Fira Mono', monospace;
    width: 100%;
`;

const ExchangeBodyCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

@observer
export class ExchangeDetailsPane extends React.Component<{ exchange: HttpExchange | undefined }> {

    @observable
    private selectedRequestContentType: HtkContentType | undefined;

    @observable
    private selectedResponseContentType: HtkContentType | undefined;

    private decodedBodyCache = new WeakMap<CompletedRequest | CompletedResponse, IObservableValue<undefined | Buffer>>();

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const { exchange } = this.props;
            if (!exchange) {
                this.setRequestContentType(undefined);
                this.setResponseContentType(undefined);
                return;
            }

            const { request, response } = exchange;

            this.setRequestContentType(this.selectedRequestContentType || request.contentType);

            if (this.decodedBodyCache.get(request) === undefined) {
                const observableResult = observable.box<undefined | Buffer>(undefined);
                this.decodedBodyCache.set(request, observableResult);

                decodeContent(request.body.buffer, request.headers['content-encoding'])
                .then(action<(result: Buffer) => void>((decodingResult) => {
                    observableResult.set(decodingResult);
                })).catch(() => {}); // Ignore errors for now - for broken encodings just spin forever
            }

            if (!response || response === 'aborted') return;

            this.setResponseContentType(this.selectedResponseContentType || response.contentType);

            if (this.decodedBodyCache.get(response) === undefined) {
                const observableResult = observable.box<undefined | Buffer>(undefined);
                this.decodedBodyCache.set(response, observableResult);

                decodeContent(response.body.buffer, response.headers['content-encoding'])
                .then(action<(result: Buffer) => void>((decodingResult) => {
                    observableResult.set(decodingResult);
                })).catch(() => {}); // Ignore errors for now - for broken encodings just spin forever
            }
        }));
    }

    render() {
        const { exchange } = this.props;
        const cards: JSX.Element[] = [];

        if (exchange) {
            const { request, response } = exchange;

            cards.push(<Card tabIndex={0} key='request' direction='right'>
                <header>
                    <Pill color={getExchangeSummaryColour(exchange)}>
                        { request.method } {
                            request.hostname
                            // Add some tiny spaces to split up parts of the hostname
                            .replace(/\./g, '\u2008.\u2008')
                        }
                    </Pill>
                    <h1>Request</h1>
                </header>
                <CardContent>
                    <ContentLabel>URL</ContentLabel>
                    <ContentValue>{
                        new URL(request.url, `${request.protocol}://${request.hostname}`).toString()
                    }</ContentValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentValue>
                        <HeaderDetails headers={request.headers} />
                    </ContentValue>
                </CardContent>
            </Card>);

            if (request.body.buffer) {
                // ! because autorun in componentDidMount should guarantee this is set
                const decodedBody = this.decodedBodyCache.get(request)!.get();

                cards.push(<Card tabIndex={0} key='requestBody' direction='right'>
                    <header>
                        { decodedBody && <Pill>{ getReadableSize(decodedBody.length) }</Pill> }
                        <ContentTypeSelector
                            onChange={this.setRequestContentType}
                            baseContentType={request.contentType}
                            selectedContentType={this.selectedRequestContentType!}
                        />
                        <h1>Request body</h1>
                    </header>
                    { decodedBody ?
                        <ExchangeBodyCardContent>
                            <ContentEditor
                                rawContentType={request.headers['content-type']}
                                contentType={this.selectedRequestContentType!}
                            >
                                {decodedBody}
                            </ContentEditor>
                        </ExchangeBodyCardContent>
                    :
                        <CardContent height='500px'>
                            <FontAwesomeIcon spin icon={['far', 'spinner-third']} size='8x' />
                        </CardContent>
                    }
                </Card>);
            }

            if (response === 'aborted') {
                cards.push(<Card tabIndex={0} key='response' direction='left'>
                    <header>
                    <Pill color={getStatusColor(response)}>Aborted</Pill>
                        <h1>Response</h1>
                    </header>
                    <CardContent>
                        The request was aborted before the response was completed.
                    </CardContent>
                </Card>);
            } else if (!!response) {
                cards.push(<Card tabIndex={0} key='response' direction='left'>
                    <header>
                        <Pill color={getStatusColor(response.statusCode)}>{ response.statusCode }</Pill>
                        <h1>Response</h1>
                    </header>
                    <CardContent>
                        <ContentLabel>Status</ContentLabel>
                        <ContentValue>
                            {response.statusCode}: {response.statusMessage}
                        </ContentValue>

                        <ContentLabel>Headers</ContentLabel>
                        <ContentValue>
                            <HeaderDetails headers={response.headers} />
                        </ContentValue>
                    </CardContent>
                </Card>);

                if (hasCompletedBody(response)) {
                    // ! because autorun in componentDidMount should guarantee this is set
                    const decodedBody = this.decodedBodyCache.get(response)!.get();

                    cards.push(<Card tabIndex={0} key='responseBody' direction='left'>
                        <header>
                            { decodedBody && <Pill>{ getReadableSize(decodedBody.length) }</Pill> }
                            <ContentTypeSelector
                                onChange={this.setResponseContentType}
                                baseContentType={response.contentType}
                                selectedContentType={this.selectedResponseContentType!}
                            />
                            <h1>Response body</h1>
                        </header>
                        { decodedBody ?
                            <ExchangeBodyCardContent>
                                <ContentEditor
                                    rawContentType={response.headers['content-type']}
                                    contentType={this.selectedResponseContentType!}
                                >
                                    {decodedBody}
                                </ContentEditor>
                            </ExchangeBodyCardContent>
                        :
                            <CardContent height='500px'>
                                <FontAwesomeIcon spin icon={['far', 'spinner-third']} size='8x' />
                            </CardContent>
                        }
                    </Card>);
                }
            }
        } else {
            cards.push(
                <EmptyState
                    key='empty'
                    tabIndex={0}
                    icon={['far', 'arrow-left']}
                    message='Select some requests to see their details.'
                />
            );
        }

        return <ExchangeDetailsContainer>
            {cards}
        </ExchangeDetailsContainer>;
    }

    @action.bound
    setRequestContentType(contentType: HtkContentType | undefined) {
        this.selectedRequestContentType = contentType;
    }

    @action.bound
    setResponseContentType(contentType: HtkContentType | undefined) {
        this.selectedResponseContentType = contentType;
    }
};