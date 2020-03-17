import * as React from 'react';
import { action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled, css } from '../../styles';

import { EventsStore } from '../../model/http/events-store';
import { HttpExchange } from '../../model/http/exchange';

import { HEADER_FOOTER_HEIGHT } from './view-event-list-footer';
import { IconButton } from '../common/icon-button';

const ButtonsContainer = styled.div`
    height: ${HEADER_FOOTER_HEIGHT}px;
    flex-shrink: 0;
    width: 100%;
    padding-left: 5px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;

    align-items: center;
    justify-content: center;

    z-index: 1;
    box-shadow: 0 -10px 30px -5px rgba(0,0,0,0.1);
`;

const PinButton = styled(observer((p: {
    className?: string,
    pinned: boolean,
    onClick: () => void
}) => <IconButton
    className={p.className}
    icon={['fas', 'thumbtack']}
    title={
        p.pinned
            ? "Unpin this request so it can be deleted"
            : "Pin this request, so it can't be deleted"
    }
    onClick={p.onClick}
/>))`
    ${p => !p.pinned && css`
        transition: transform 0.1s;
        transform: rotate(45deg);
    `}
`;

const DeleteButton = observer((p: {
    disabled: boolean,
    onDelete: () => void
}) => <IconButton
    icon={['far', 'trash-alt']}
    title='Delete this request and response'
    disabled={p.disabled}
    onClick={p.onDelete}
/>);

export const ExchangeDetailsFooter = inject('eventsStore')(
    observer(
        (props: {
            eventsStore?: EventsStore,
            exchange: HttpExchange
        }) => {
            const { exchange } = props;
            const { pinned } = exchange;

            return <ButtonsContainer>
                <PinButton
                    pinned={pinned}
                    onClick={action(() => {
                        exchange.pinned = !exchange.pinned;
                    })}
                />
                <DeleteButton
                    disabled={pinned}
                    onDelete={() => {
                        props.eventsStore!.deleteEvent(exchange)
                    }}
                />
            </ButtonsContainer>;
        }
    )
);