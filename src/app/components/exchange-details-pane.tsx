import * as React from "react";
import styled from 'styled-components';

import ContentSize from './editor/content-size';

import { EmptyState } from './empty-state';
import { HeaderDetails } from './header-details';
import { EditorController } from "./editor/editor-controller";
import { HttpExchange } from "../model/store";

const ExchangeDetailsContainer = styled.div`
    position: relative;

    min-height: 100%;
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
    height: ${(props: any) => Math.min(props.height, 500)}px;

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

export const ExchangeDetailsPane = ({ exchange }: {
    exchange: HttpExchange | undefined
}) => {
    const url = exchange && new URL(
        exchange.request.url,
        `${exchange.request.protocol}://${exchange.request.hostname}`
    );

    const contentType = exchange && exchange.request.headers['content-type'];
    const reqBodyText = exchange && exchange.request.body && exchange.request.body.text;

    return <ExchangeDetailsContainer>{
        exchange ? (<>
            <Card>
                <CardHeader>Request details</CardHeader>
                <CardContent>
                    <ContentLabel>URL</ContentLabel>
                    <ContentValue>{url!.toString()}</ContentValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentValue>
                        <HeaderDetails headers={exchange.request.headers} />
                    </ContentValue>
                </CardContent>
            </Card>

            { reqBodyText && <Card>
                <EditorController
                    contentType={contentType}
                    content={reqBodyText}
                    options={{
                        automaticLayout: true,
                        readOnly: true,
                        showFoldingControls: 'always',

                        quickSuggestions: false,
                        parameterHints: false,
                        codeLens: false,
                        minimap: { enabled: false },
                        contextmenu: false,
                        scrollBeyondLastLine: false,

                        // TODO: Would like to set a fontFace here, but due to
                        // https://github.com/Microsoft/monaco-editor/issues/392
                        // it breaks wordwrap

                        fontSize: 16,
                        wordWrap: 'on'
                    }}
                >
                    { ({ editor, contentTypeSelector, lineCount }) => <>
                        <CardHeader>
                            Request body

                            <ContentSize content={reqBodyText!} />

                            { contentTypeSelector }
                        </CardHeader>
                        <ExchangeBodyCardContent height={lineCount * 22}>
                            { editor }
                        </ExchangeBodyCardContent>
                    </> }
                </EditorController>
            </Card> }

            { exchange.response && <Card>
                <CardHeader>Response details</CardHeader>
                <CardContent>
                    <ContentLabel>Status</ContentLabel>
                    <ContentValue>{exchange.response.statusCode}: {exchange.response.statusMessage}</ContentValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentValue>
                        <HeaderDetails headers={exchange.response.headers} />
                    </ContentValue>
                </CardContent>
            </Card> }
        </>) :
            <EmptyState
                icon={['far', 'arrow-left']}
                message='Select some requests to see their details.'
            />
    }</ExchangeDetailsContainer>
}