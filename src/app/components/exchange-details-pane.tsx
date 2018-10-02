import * as React from 'react';
import { get } from 'typesafe-get';
import styled from 'styled-components';

import ContentSize from './editor/content-size';

import { EmptyState } from './empty-state';
import { HeaderDetails } from './header-details';
import { EditorController } from './editor/editor-controller';
import { HttpExchange } from '../model/store';

const ExchangeDetailsContainer = styled.div`
    position: relative;
    overflow-y: auto;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
`;

const Card = styled.div`
    width: calc(100% - 10px);
    overflow: hidden;
    word-break: break-all;

    margin: 5px;

    background-color: ${props => props.theme.mainBackground};
    border-radius: 4px;
    overflow: hidden;
`;

const CardHeader = styled.div`
    width: 100%;
    height: 40px;
    padding: 10px;
    box-sizing: border-box;

    display: flex;
    align-items: center;

    text-transform: uppercase;

    color: ${props => props.theme.headingColor};
    background-color: ${props => props.theme.headingBackground};
    border-bottom: 1px solid ${props => props.theme.headingBorder};
`;

const CardContent = styled.div`
    width: 100%;
    padding: 10px;
    box-sizing: border-box;
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

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

export const ExchangeDetailsPane = ({ exchange }: {
    exchange: HttpExchange | undefined
}) => {
    const cards: JSX.Element[] = [];

    if (exchange) {
        const { request, response } = exchange;

        cards.push(<Card>
            <CardHeader>Request</CardHeader>
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
            cards.push(<Card>
                <EditorController
                    contentType={request.headers['content-type']}
                    content={requestBody}
                >
                    { ({ editor, contentTypeSelector, lineCount }) => <>
                        <CardHeader>
                            Request body <ContentSize content={requestBody} />
                            { contentTypeSelector }
                        </CardHeader>
                        <ExchangeBodyCardContent height={lineCount * 22}>
                            { editor }
                        </ExchangeBodyCardContent>
                    </> }
                </EditorController>
            </Card>);
        }

        if (response) {
            cards.push(<Card>
                <CardHeader>Response</CardHeader>
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
                cards.push(<Card>
                    <EditorController
                        contentType={response.headers['content-type']}
                        content={responseBody}
                    >
                        { ({ editor, contentTypeSelector, lineCount }) => <>
                            <CardHeader>
                                Response body <ContentSize content={responseBody} />
                                { contentTypeSelector }
                            </CardHeader>
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
                icon={['far', 'arrow-left']}
                message='Select some requests to see their details.'
            />
        );
    }

    return <ExchangeDetailsContainer>{cards}</ExchangeDetailsContainer>;
}