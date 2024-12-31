import * as React from 'react';

import { styled } from '../../styles';
import { ContentLabel } from '../common/text-content';

const BreakdownContainer = styled.dl`
    display: grid;
    grid-template-columns: fit-content(50%) auto;
    grid-gap: 5px;
`;

const BreakdownKey = styled.dt`
    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
    text-align: right;
`;

const BreakdownValue = styled.dd`
    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
    white-space: pre-wrap;
`;

const ParameterSeparator = styled(ContentLabel)`
    margin-top: 10px;
    grid-column: 1 / span 2;
`;

export const UrlBreakdown = (p: { url: URL }) => {
    const params = [...p.url.searchParams];

    let decodedPathname: string;
    try {
        decodedPathname = decodeURIComponent(p.url.pathname);
    } catch (e) {
        decodedPathname = p.url.pathname;
    }

    return <BreakdownContainer role='region'>
        <BreakdownKey>Protocol:</BreakdownKey> <BreakdownValue>{ p.url.protocol.slice(0, -1) }</BreakdownValue>

        { (p.url.username || p.url.password) && <>
            <BreakdownKey>Username:</BreakdownKey> <BreakdownValue>{ p.url.username }</BreakdownValue>
            <BreakdownKey>Password:</BreakdownKey> <BreakdownValue>{ p.url.password }</BreakdownValue>
        </> }

        <BreakdownKey>Host:</BreakdownKey> <BreakdownValue>{ p.url.host }</BreakdownValue>
        <BreakdownKey>Path:</BreakdownKey> <BreakdownValue>{ decodedPathname }</BreakdownValue>

        { params.length ? <ParameterSeparator>Parameters</ParameterSeparator> : null }

        { params.map(([key, value], i) => [
            <BreakdownKey key={`${i}-key`}>{ key }:</BreakdownKey>,
            <BreakdownValue key={`${i}-value`}>{ value }</BreakdownValue>
        ]) }
    </BreakdownContainer>;
}