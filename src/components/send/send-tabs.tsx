import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { css, styled } from '../../styles';

import { SendRequest } from '../../model/send/send-request-model';
import { getMethodColor } from '../../model/events/categorization';

import { UnstyledButton } from '../common/inputs';
import { IconButton } from '../common/icon-button';

export const TAB_BAR_HEIGHT = '38px';

const TabsContainer = styled.div.attrs(() => ({
    role: 'tablist'
}))`
    width: 100%;
    height: ${TAB_BAR_HEIGHT};
    box-sizing: border-box;

    background-color: ${p => p.theme.containerBackground};

    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-direction: row;
    align-items: end;
`;

const TabContainer = styled.div<{ selected: boolean }>`
    box-sizing: border-box;

    width: 200px;
    height: ${TAB_BAR_HEIGHT};

    flex-grow: 0;
    flex-shrink: 1;
    overflow: hidden;

    display: flex;
    flex-direction: row;

    ${p => p.selected
        ? css`
            margin-bottom: -1px;

            border-bottom: 3px solid ${p => p.theme.popColor};

            background-color: ${p => p.theme.mainBackground};
            box-shadow: 0 0 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
            z-index: 1;
        `
        : css`
            background-color: ${p => p.theme.mainLowlightBackground};

            border-bottom: 3px solid transparent;

            &:hover {
                background-color: ${p => p.theme.mainBackground};
            }
        `
    }
`;

const TabMethodMarker = styled.span<{ method: string }>`
    color: ${p => getMethodColor(p.method)};
    font-size: ${p => p.theme.textInputFontSize};
    margin-right: 5px;
`;

const TabName = styled.span`
    &:empty::before {
        content: 'New request';
        font-style: italic;
        opacity: ${p => p.theme.lowlightTextOpacity};
        text-align: center;
    }
`;

const CloseTabButton = styled(IconButton)`
`;

const AddTabButton = styled(IconButton)`
    align-self: center;
`;

const TabButton = styled(UnstyledButton).attrs((p: { selected: boolean }) => ({
    role: 'tab',
    'aria-selected': p.selected.toString(),
    'tabindex': p.selected ? '0' : '-1'
}))`
    flex-basis: 100%;
    flex-grow: 1;
    flex-shrink: 1;

    text-align: left;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;

    padding: 0 10px;

    :focus-visible {
        outline: none;
        font-weight: bold;

        & + ${CloseTabButton} {
            color: ${p => p.theme.popColor};
        }
    }
`;

const SendTab = observer((props: {
    sendRequest: SendRequest,
    isSelectedTab: boolean,
    onSelectTab: (request: SendRequest) => void,
    onCloseTab: (request: SendRequest) => void
}) => {
    const { request } = props.sendRequest;

    const onTabClick = React.useCallback(() => {
        props.onSelectTab(props.sendRequest)
    }, [props.onSelectTab, props.sendRequest]);

    const onTaxAuxClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button === 1) { // Middle mouse click
            props.onCloseTab(props.sendRequest);
        }
    }, [props.onCloseTab, props.sendRequest]);

    const onCloseClick = React.useCallback((event: React.SyntheticEvent) => {
        props.onCloseTab(props.sendRequest);
        event.stopPropagation();
    }, [props.onCloseTab, props.sendRequest]);

    return <TabContainer
        selected={props.isSelectedTab}
        onClick={onTabClick}
        onAuxClick={onTaxAuxClick}
    >
        <TabButton
            selected={props.isSelectedTab}
            tabIndex={props.isSelectedTab ? 0 : -1}
        >
            <TabMethodMarker method={request.method}>
                { request.method }
            </TabMethodMarker>

            <TabName>{
                request.url.replace(/^https?:\/\//, '') || ''
            }</TabName>
        </TabButton>

        {
            props.isSelectedTab && <CloseTabButton
                title='Close this tab'
                icon={['fas', 'times']}
                onClick={onCloseClick}
                tabIndex={-1} // No focus - keyboard closes via 'Delete' instead
            />
        }
    </TabContainer>;
});

export const SendTabs = observer((props: {
    sendRequests: Array<SendRequest>;
    selectedTab: SendRequest;
    onSelectTab: (sendRequest: SendRequest) => void;
    onMoveSelection: (distance: number) => void;
    onCloseTab: (sendRequest: SendRequest) => void;
    onAddTab: () => void;
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const focusSelectedEvent = React.useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const selectedTab = container.querySelector('[role=tab][aria-selected=true]') as HTMLButtonElement;
        if (!selectedTab) return;
        selectedTab.focus();
    }, [containerRef]);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        // Note that selected tab === focused tab so no worries differentiating the two
        if (event.key === 'Delete') {
            props.onCloseTab(props.selectedTab);
        } else if (event.key === 'ArrowRight') {
            props.onMoveSelection(1);
        } else if (event.key === 'ArrowLeft') {
            props.onMoveSelection(-1);
        } else if (event.key === 'Home') {
            props.onMoveSelection(-Infinity);
        } else if (event.key === 'End') {
            props.onMoveSelection(Infinity);
        } else {
            return;
        }

        // In all the above cases, we want to update the focus to match:
        requestAnimationFrame(() => focusSelectedEvent());
    }, [props.onCloseTab, props.selectedTab, props.onMoveSelection, focusSelectedEvent]);

    const onAddButtonKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        event.stopPropagation();
    }, []);

    return <TabsContainer
        ref={containerRef}
        onKeyDown={onKeyDown}
    >
        {
            props.sendRequests.map((sendRequest) => {
                const isSelectedTab = props.selectedTab === sendRequest;
                return <SendTab
                    key={sendRequest.id}
                    sendRequest={sendRequest}
                    isSelectedTab={isSelectedTab}
                    onSelectTab={props.onSelectTab}
                    onCloseTab={props.onCloseTab}
                />
            })
        }

        <AddTabButton
            title='Add another tab to send a new request'
            icon={['fas', 'plus']}
            onKeyDown={onAddButtonKeyDown}
            onClick={() => props.onAddTab()}
        />
    </TabsContainer>
});