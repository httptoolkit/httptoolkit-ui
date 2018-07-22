import * as React from "react";
import styled from 'styled-components';

import ContentSize from './content-size';

import { MockttpRequest } from "../types";
import { EmptyState } from './empty-state';
import { HeaderDetails } from './header-details';

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
    border-radius: 2px;
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

const RequestBody = styled.div`
    font-family: 'Fira Mono', monospace;
`;


export const RequestDetailsPane = styled((props: {
    className?: string,
    request: MockttpRequest | undefined
}) => {
    const url = props.request &&
        new URL(props.request.url, `${props.request.protocol}://${props.request.hostname}`);

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
                <CardHeader>
                    Request body <ContentSize content={bodyText!} />
                </CardHeader>
                <CardContent>
                    <RequestBody>
                        { bodyText }
                    </RequestBody>
                </CardContent>
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