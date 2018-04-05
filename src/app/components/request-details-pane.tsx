import * as React from "react";
import styled from 'styled-components';
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

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
    padding: 5px;
    box-sizing: border-box;
`;

const Card = styled.div`
    width: 100%;
    overflow: hidden;
    word-break: break-all;
    
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

    color: ${props => props.theme.popColor};
    background-color: ${props => props.theme.popBackground};
    border-bottom: 1px solid ${props => props.theme.popBorder};
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
    font-family: monospace; /* TODO: Find a nice monospaced font */
`;


export const RequestDetailsPane = styled((props: {
    className?: string,
    request: MockttpRequest | undefined
}) => {
    const url = props.request &&
        new URL(props.request.url, `${props.request.protocol}://${props.request.hostname}`);
    
    return <RequestDetailsContainer className={props.className}>{
        props.request ?
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
        :
            <EmptyState
                icon={['far', 'arrow-left']}
                message='Select some requests to see their details.'
            />
    }</RequestDetailsContainer>
})`
    height: 100%;
`;