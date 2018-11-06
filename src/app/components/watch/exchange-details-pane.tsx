import * as _ from 'lodash';
import * as React from 'react';
import * as utf8 from 'utf8';
import { get } from 'typesafe-get';
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, autorun } from 'mobx';

import { styled, css } from '../../styles';
import { HttpExchange } from '../../model/store';
import { getExchangeSummaryColour, getStatusColor } from '../../exchange-colors';

import { Pill } from '../pill';
import { CollapsibleCard, CollapseIcon } from '../card'
import { EmptyState } from '../empty-state';
import { HeaderDetails } from './header-details';
import { EditorController } from '../editor/editor-controller';
import { ContentTypeSelector } from '../editor/content-type-selector';

const ExchangeDetailsContainer = styled.div`
    position: relative;
    overflow-y: auto;

    height: 100%;
    width: 100%;
    box-sizing: border-box;

    background-color: ${p => p.theme.containerBackground};
`;

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

const CardContent = styled.div`
`;

const ContentLabel = styled.div`
    text-transform: uppercase;
    opacity: 0.5;

    margin-bottom: 10px;

    &:not(:first-child) {
        margin-top: 10px;
    }
`;

const ContentValue = styled.div`
    font-family: 'Fira Mono', monospace;
`;

const ExchangeBodyCardContent = styled.div`
    height: ${(p: { height: number }) => Math.min(p.height, 500)}px;

    margin: 0 -20px -20px -20px;

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

@observer
export class ExchangeDetailsPane extends React.Component<{ exchange: HttpExchange | undefined }> {

    @observable
    private requestContentType: string | undefined;

    @observable
    private responseContentType: string | undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (!this.props.exchange) {
                this.setRequestContentType(undefined);
                this.setResponseContentType(undefined);
                return;
            }

            this.setRequestContentType(
                this.requestContentType ||
                this.props.exchange.request.headers['content-type']
            );

            if (!this.props.exchange.response) return;

            this.setResponseContentType(
                this.responseContentType ||
                this.props.exchange.response.headers['content-type']
            );
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

            const requestBody = get(request, 'body', 'text');
            if (requestBody) {
                cards.push(<Card tabIndex={0} key='requestBody' direction='right'>
                    <header>
                        <Pill>{ getReadableSize(utf8.encode(requestBody).length) }</Pill>
                        <ContentTypeSelector
                            onChange={this.setRequestContentType}
                            contentType={this.requestContentType!}
                        />
                        <h1>Request body</h1>
                    </header>
                    <EditorController
                        contentType={this.requestContentType!}
                        content={requestBody}
                    >
                        { ({ editor, lineCount }) => <>
                            <ExchangeBodyCardContent height={lineCount * 22}>
                                { editor }
                            </ExchangeBodyCardContent>
                        </> }
                    </EditorController>
                </Card>);
            }

            if (response) {
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

                const responseBody = get(response, 'body', 'text');
                if (responseBody) {
                    cards.push(<Card tabIndex={0} key='responseBody' direction='left'>
                        <header>
                            <Pill>{ getReadableSize(utf8.encode(responseBody).length) }</Pill>
                            <ContentTypeSelector
                                onChange={this.setResponseContentType}
                                contentType={this.responseContentType!}
                            />
                            <h1>Response body</h1>
                        </header>
                        <EditorController
                            contentType={this.responseContentType!}
                            content={responseBody}
                        >
                            { ({ editor, lineCount }) => <>
                                <ExchangeBodyCardContent height={lineCount * 22}>
                                    { editor }
                                </ExchangeBodyCardContent>
                            </> }
                        </EditorController>
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
    setRequestContentType(contentType: string | undefined) {
        this.requestContentType = contentType && contentType.split(';')[0];
    }

    @action.bound
    setResponseContentType(contentType: string | undefined) {
        this.responseContentType = contentType && contentType.split(';')[0];
    }
};