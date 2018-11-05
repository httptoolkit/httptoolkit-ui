import * as React from 'react';
import * as utf8 from 'utf8';
import { get } from 'typesafe-get';
import { observer } from 'mobx-react';

import { styled, css } from '../../styles';
import { HttpExchange } from '../../model/store';

import { MediumCard } from '../card'
import { EmptyState } from '../empty-state';
import { HeaderDetails } from '../header-details';
import { EditorController } from '../editor/editor-controller';
import { Pill } from '../pill';
import { getExchangeSummaryColour, getStatusColor } from '../exchange-colors';

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

const Card = styled(MediumCard)`
    margin: 20px;
    word-break: break-all;

    ${(p: { direction: 'left' | 'right' }) => cardDirectionCss(p.direction)};

    &:focus, &:focus-within {
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

export const ExchangeDetailsPane = observer(({ exchange }: {
    exchange: HttpExchange | undefined
}) => {
    const cards: JSX.Element[] = [];

    if (exchange) {
        const { request, response } = exchange;

        cards.push(<Card tabIndex={0} key='request' direction='right'>
            <header>
                <Pill color={getExchangeSummaryColour(exchange)}>{ request.method } { request.hostname }</Pill>
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
                <EditorController
                    contentType={request.headers['content-type']}
                    content={requestBody}
                >
                    { ({ editor, contentTypeSelector, lineCount }) => <>
                        <header>
                            <Pill>{ getReadableSize(utf8.encode(requestBody).length) }</Pill>
                            { contentTypeSelector }
                            <h1>
                                Request body
                            </h1>
                        </header>
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
                    <EditorController
                        contentType={response.headers['content-type']}
                        content={responseBody}
                    >
                        { ({ editor, contentTypeSelector, lineCount }) => <>
                            <header>
                                <Pill>{ getReadableSize(utf8.encode(responseBody).length) }</Pill>
                                { contentTypeSelector }
                                <h1>
                                    Response body
                                </h1>
                            </header>
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
});