import * as _ from 'lodash';
import * as React from "react";
import styled, { css } from 'styled-components';

import { MockttpRequest } from "../types";

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

export const HeaderDetails = (props: { headers: { [key: string]: string }, className?: string }) => {
    return <table className={props.className}>
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