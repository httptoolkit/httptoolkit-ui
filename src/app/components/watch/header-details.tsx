import * as _ from 'lodash';
import * as React from 'react';
import { styled, css } from '../../styles';

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

export const HeaderDetails = (props: { headers: { [key: string]: string }, className?: string }) => {
    return _.isEmpty(props.headers) ?
        <EmptyState>(None)</EmptyState>
    :
        <table className={props.className}>
            <tbody>
                { _.map(props.headers, (value, name) => 
                    <tr key={name}>
                        <NameCell>{ name }</NameCell>
                        <ValueCell>{ value }</ValueCell>
                    </tr>
                ) }
            </tbody>
        </table>
};