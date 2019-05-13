import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles'

import { HttpExchange } from '../../model/exchange';

import { ClearAllButton, DownloadAsHarButton, ImportHarButton, PlayPauseButton } from './exchange-list-buttons';
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
            { props.exchangeCount !== props.filteredExchangeCount &&
                ` / ${ props.exchangeCount }`
            }
        </span>
        <span className='label'>requests</span>
</div>
))`
    margin-left: auto;
    padding: 0 10px;

    display: flex;
    flex-direction: column;
    align-items: flex-end;

    .count {
        font-size: 20px;
        font-weight: bold;
        white-space: nowrap;
    }

    .label {
        margin-top: -4px;
        font-size: ${p => p.theme.textSize};
        opacity: 0.8;
        font-weight: lighter;
    }
`;

const ExchangeSearchBox = styled(SearchBox)`
    flex-basis: 60%;

    > input {
        font-size: ${p => p.theme.textSize};
        padding: 5px 12px;
    }
`;

const ButtonsContainer = styled.div`
    display: flex;
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
    <ButtonsContainer>
        <PlayPauseButton />
        <DownloadAsHarButton exchanges={props.filteredExchanges} />
        <ImportHarButton />
        <ClearAllButton disabled={props.allExchanges.length === 0} onClear={props.onClear} />
    </ButtonsContainer>
</div>))`
    position: absolute;
    bottom: 0;

    height: ${HEADER_FOOTER_HEIGHT}px;
    width: 100%;
    padding-left: 5px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    justify-content: space-between;
`;