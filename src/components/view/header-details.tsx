import * as _ from 'lodash';
import * as React from 'react';

import { styled, css } from '../../styles';
import { getDocsUrl, getDocsSummary } from '../../model/headers';

const Cell = css`
    padding: 0 10px 5px 0;
    vertical-align: top;
`;

const NameCell = styled.td`
    ${Cell};
    white-space: nowrap;
`;

const ValueCell = styled.td`
    ${Cell};
`;

const EmptyState = styled.div`
    opacity: 0.5;
    font-style: italic;
`;


const HeaderInfo = styled.a`
    ${p => !!p.href && 'text-decoration: underline dotted #888'};
    opacity: ${p => !!p.href ? 1 : 0.7};
    color: ${p => p.theme.mainColor};

    &:active {
        color: ${p => p.theme.popColor};
    }
`;

export const HeaderDetails = (props: { headers: { [key: string]: string }, className?: string }) => {
    return _.isEmpty(props.headers) ?
        <EmptyState>(None)</EmptyState>
    :
        <table className={props.className}>
            <tbody>
                { _.map(props.headers, (value, name) =>
                    <tr key={name}>
                        <NameCell>
                            <HeaderInfo href={getDocsUrl(name)} title={getDocsSummary(name)} target="_blank">
                                { name }
                            </HeaderInfo>
                        </NameCell>
                        <ValueCell>{ value }</ValueCell>
                    </tr>
                ) }
            </tbody>
        </table>
};