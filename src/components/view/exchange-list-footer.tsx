import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles'

import { HttpExchange } from '../../model/exchange';

import { ClearAllButton, DownloadAsHarButton } from './exchange-list-buttons';
import { SearchBox } from '../common/search-box';

export const HEADER_FOOTER_HEIGHT = 38;

const RequestCounter = styled(observer((props: {
    className?: string,
    exchangeCount: number,
    filteredExchangeCount: number
}) =>
    <div className={props.className}>
        <span className='count'>
            { props.filteredExchangeCount }
            { props.exchangeCount !== props.filteredExchangeCount && `
                / ${ props.exchangeCount }
            `}
        </span>
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

const ExchangeSearchBox = styled(SearchBox)`
    flex-basis: 60%;

    > input {
        font-size: ${p => p.theme.textSize};
        padding: 5px 12px;
    }
`;

export const TableFooter = styled(observer((props: {
    className?: string,
    onClear: () => void,
    currentSearch: string,
    onSearch: (input: string) => void,

    allExchanges: HttpExchange[],
    filteredExchanges: HttpExchange[]
}) => <div className={props.className}>
    <ExchangeSearchBox
        value={props.currentSearch}
        onSearch={props.onSearch}
        placeholder='Filter by URL, headers, status...'
    />
    <RequestCounter
        exchangeCount={props.allExchanges.length}
        filteredExchangeCount={props.filteredExchanges.length}
    />
    <DownloadAsHarButton
        exchanges={props.filteredExchanges}
        exchangesAreFiltered={props.filteredExchanges.length !== props.allExchanges.length}
    />
    <ClearAllButton disabled={props.allExchanges.length === 0} onClear={props.onClear} />
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