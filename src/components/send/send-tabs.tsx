import * as React from 'react';

import { css, styled } from '../../styles';
import { UnstyledButton } from '../common/inputs';
import { SendRequest } from '../../model/send/send-request-model';
import { getMethodColor } from '../../model/events/categorization';
import { observer } from 'mobx-react';
import { IconButton } from '../common/icon-button';
import { noPropagation } from '../component-utils';

export const TAB_BAR_HEIGHT = '38px';

const TabsContainer = styled.div.attrs(() => ({
    role: 'tablist'
}))`
    width: 100%;
    height: ${TAB_BAR_HEIGHT};
    box-sizing: border-box;

    background-color: ${p => p.theme.containerBackground};
    border-bottom: 1px solid ${p => p.theme.containerWatermark};

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

export const SendTabs = observer((props: {
    sendRequests: Array<SendRequest>;
    selectedTab: SendRequest;
    onSelectTab: (sendRequest: SendRequest) => void;
    onCloseTab: (sendRequest: SendRequest) => void;
    onAddTab: () => void;
}) => {


    return <TabsContainer>
        {
            props.sendRequests.map((sendRequest) => {
                const { id, request } = sendRequest;

                const isSelected = props.selectedTab === sendRequest;

                return <TabContainer
                    key={id}
                    selected={isSelected}
                    onClick={() => props.onSelectTab(sendRequest)}
                >
                    <TabButton selected={isSelected}>
                        <TabMethodMarker method={request.method}>
                            { request.method }
                        </TabMethodMarker>

                        <TabName>{
                            request.url.replace(/^https?:\/\//, '') || ''
                        }</TabName>
                    </TabButton>

                    {
                        isSelected && <CloseTabButton
                            title='Close this tab'
                            icon={['fas', 'times']}
                            onClick={noPropagation(() => props.onCloseTab(sendRequest))}
                        />
                    }
                </TabContainer>;
            })
        }

        <AddTabButton
            title='Add another tab to send a new request'
            icon={['fas', 'plus']}
            onClick={() => props.onAddTab()}
        />
    </TabsContainer>
});