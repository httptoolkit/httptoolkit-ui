import * as React from 'react';
import { observer } from 'mobx-react';

import { HttpExchange } from '../../types';
import { styled } from '../../styles'

import { ClearArrayButton } from './clear-button';
import { HEADER_FOOTER_HEIGHT } from './exchange-list';

const RequestCounter = styled(observer((props: {
    className?: string,
    exchanges: HttpExchange[]
}) =>
    <div className={props.className}>
        <span className='count'>{props.exchanges.length}</span>
        <span className='label'>requests</span>
    </div>
))`
    min-width: 120px;

    .count {
        font-size: 20px;
        font-weight: bold;
    }

    .label {
        font-size: ${p => p.theme.textSize};
        font-weight: lighter;
        margin-left: 5px;
    }
`;

export const TableFooter = styled(observer((props: {
    className?: string,
    onClear: () => void,
    exchanges: HttpExchange[]
}) => <div className={props.className}>
    <RequestCounter exchanges={props.exchanges} />
    <ClearArrayButton array={props.exchanges} onClear={props.onClear} />
</div>))`
    position: absolute;
    bottom: 0;

    width: 100%;
    height: ${HEADER_FOOTER_HEIGHT}px;
    background-color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    justify-content: space-around;
`;