import * as React from "react";
import styled from 'styled-components';

import ContentSize from './editor/content-size';

import { MockttpRequest } from "../types";
import { EmptyState } from './empty-state';
import { HeaderDetails } from './header-details';
import { EditorController } from "./editor/editor-controller";

const RequestDetailsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: stretch;

    position: relative;

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

const RequestBodyCardContent = styled.div`
    height: ${(props: any) => Math.min(props.height, 500)}px;

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

export const RequestDetailsPane = styled((props: {
    className?: string,
    request: MockttpRequest | undefined
}) => {
    const url = props.request &&
        new URL(props.request.url, `${props.request.protocol}://${props.request.hostname}`);

    const contentType = props.request && props.request.headers['content-type'];
    const bodyText = props.request && props.request.body && props.request.body.text;

    return <RequestDetailsContainer className={props.className}>{
        props.request ? (<>
            <Card>
                <CardHeader>Request details</CardHeader>
                <CardContent>
                    <ContentLabel>URL</ContentLabel>
                    <ContentValue>{url!.toString()}</ContentValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentValue>
                        <HeaderDetails headers={props.request.headers} />
                    </ContentValue>
                </CardContent>
            </Card>

            { bodyText && <Card>
                <EditorController
                    contentType={contentType}
                    content={bodyText}
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

                            <ContentSize content={bodyText!} />

                            { contentTypeSelector }
                        </CardHeader>
                        <RequestBodyCardContent height={lineCount * 22}>
                            { editor }
                        </RequestBodyCardContent>
                    </> }
                </EditorController>
            </Card> }
        </>) :
            <EmptyState
                icon={['far', 'arrow-left']}
                message='Select some requests to see their details.'
            />
    }</RequestDetailsContainer>
})`
    height: 100%;
`;