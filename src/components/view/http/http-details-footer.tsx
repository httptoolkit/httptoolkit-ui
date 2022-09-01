import * as React from 'react';
import { action, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';

import { CollectedEvent } from '../../../types';
import { styled, css } from '../../../styles';
import { Ctrl } from '../../../util/ui';

import { HttpExchange } from '../../../model/http/exchange';
import { RulesStore } from '../../../model/rules/rules-store';
import { buildRuleFromExchange } from '../../../model/rules/rule-creation';

import { HEADER_FOOTER_HEIGHT } from '../view-event-list-footer';
import { IconButton } from '../../common/icon-button';

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

const ScrollToButton = observer((p: {
    onClick: () => void
}) => <IconButton
    icon={['fas', 'eye']}
    title={'Scroll the list to show this exchange'}
    onClick={p.onClick}
/>);

const PinButton = styled(observer((p: {
    className?: string,
    pinned: boolean,
    onClick: () => void
}) => <IconButton
    className={p.className}
    icon={['fas', 'thumbtack']}
    title={
        (
            p.pinned
            ? "Unpin this exchange so it can be deleted"
            : "Pin this exchange, so it can't be deleted"
        ) + ` (${Ctrl}+P)`
    }
    onClick={p.onClick}
/>))`
    transition: transform 0.1s;

    ${p => !p.pinned && css`
        transform: rotate(45deg);
    `}
`;

const DeleteButton = observer((p: {
    pinned: boolean,
    onClick: () => void
}) => <IconButton
    icon={['far', 'trash-alt']}
    title={`Delete this exchange (${Ctrl}+Delete)`}
    onClick={p.onClick}
/>);

const MockButton = observer((p: {
    isExchange: boolean,
    isPaidUser: boolean,
    onClick: () => void
}) => <IconButton
    icon={['fas', 'theater-masks']}
    onClick={p.onClick}
    title={
        p.isPaidUser
            ? 'Create a mock rule from this exchange'
            : 'With Pro: create a mock rule from this exchange'
    }
    disabled={!p.isExchange || !p.isPaidUser}
/>);

export const HttpDetailsFooter = inject('rulesStore')(
    observer(
        (props: {
            rulesStore?: RulesStore,

            event: CollectedEvent,
            onDelete: (event: CollectedEvent) => void,
            onScrollToEvent: (event: CollectedEvent) => void,
            isPaidUser: boolean,
            navigate: (url: string) => void
        }) => {
            const { event } = props;
            const { pinned } = event;

            return <ButtonsContainer>
                <ScrollToButton
                    onClick={() => props.onScrollToEvent(props.event)}
                />
                <PinButton
                    pinned={pinned}
                    onClick={action(() => {
                        event.pinned = !event.pinned;
                    })}
                />
                <DeleteButton
                    pinned={pinned}
                    onClick={() => props.onDelete(event)}
                />
                <MockButton
                    isExchange={event.isHttp()}
                    isPaidUser={props.isPaidUser}
                    onClick={() => {
                        const rule = buildRuleFromExchange(
                            event as HttpExchange
                        );
                        runInAction(() => {
                            props.rulesStore!.draftRules.items.unshift(rule);
                        });
                        props.navigate(`/mock/${rule.id}`);
                    }}
                />
            </ButtonsContainer>;
        }
    )
);