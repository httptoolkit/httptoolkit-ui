import * as React from 'react';
import * as dateFns from 'date-fns';
import { inject, observer } from 'mobx-react';

import { css, styled } from '../../styles';
import { Ctrl, saveFile } from '../../util/ui';
import { CollectedEvent } from '../../types';
import { AccountStore } from '../../model/account/account-store';
import { generateHar } from '../../model/http/har';

import { Icon } from '../../icons';
import { Button } from '../common/inputs';
import { GetProOverlay } from '../account/pro-placeholders';

import { getEventPreviewContent, getEventMarkerColor, isOpaqueConnection } from './event-rows/event-row';
import { uppercaseFirst } from '../../util/text';

const SummaryContainer = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const PreviewStack = styled.div`
    position: relative;
    width: 80%;
    height: 160px;
`;

const PreviewRow = styled.div<{
    index: number,
    markerColor: string,
    dimRow: boolean
}>`
    position: absolute;
    top: calc(50% - ${p => p.index * 4}px);
    transform: translateY(-50%) scaleX(${p => 1 - p.index * 0.03});
    height: 40px;

    left: 0;
    right: 0;

    background-color: ${p =>
        p.dimRow
        ? p.theme.mainBackground + Math.round(p.theme.lowlightTextOpacity * 255).toString(16)
        : p.theme.mainBackground
    };
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    opacity: ${p => 1 - p.index * 0.12};
    z-index: ${p => 9 - p.index};

    border-left: 5px solid ${p => p.markerColor};

    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 10px 0;
    box-sizing: border-box;

    font-size: ${p => p.theme.textSize};
    color: ${p => p.dimRow ? p.theme.mainColor : p.theme.containerWatermark};

    overflow: hidden;
    white-space: nowrap;

    transition: top 0.15s ease-out,
                transform 0.15s ease-out,
                opacity 0.15s ease-out;
`;

const SelectionLabel = styled.div`
    position: absolute;
    top: calc(50% - 24px);
    left: 0;
    right: 0;
    transform: translateY(-50%);
    z-index: 10;

    text-align: center;
    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
    letter-spacing: -1px;

    background: radial-gradient(
        ellipse at center,
        ${p => p.theme.containerBackground}c0 30%,
        transparent 70%
    );
    padding: 50px 0;

    pointer-events: none;
`;

const ActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 30px;
    width: 60%;
    max-width: 360px;
`;

const ActionButton = styled(Button)`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    padding: 10px 16px;
    font-size: ${p => p.theme.textSize};

    > .fa-fw {
        width: 1.25em;
        flex-shrink: 0;
    }
`;

const PinIcon = styled(Icon).attrs({
    icon: ['fas', 'thumbtack']
})`
    transition: transform 0.1s;

    ${(p: { pinned: boolean }) => !p.pinned && css`
        transform: rotate(45deg);
    `}
`;

const ProDivider = styled.hr`
    width: 100%;
    margin: 36px 0;
    border: none;
    border: solid 1px ${p => p.theme.mainColor};
`;

const ProActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    width: 100%;
`;

const ProActionsOverlay = styled(GetProOverlay)`
    min-height: 0;

    > button {
        top: 50%;
    }
`;

const PREVIEW_COUNT = 10;

export const MultiSelectionSummaryPane = inject('accountStore')(observer((props: {
    accountStore?: AccountStore,
    selectedEvents: ReadonlyArray<CollectedEvent>,
    onPin: () => void,
    onDelete: () => void,
    onBuildRule: () => void
}) => {
    const { selectedEvents } = props;
    const count = selectedEvents.length;
    const isPaidUser = props.accountStore!.user.isPaidUser();

    const httpCount = selectedEvents.filter(e =>
        e.isHttp() && !e.isWebSocket()
    ).length;

    const allHttp = count > 0 && selectedEvents.every(e => e.isHttp());
    const allPinned = selectedEvents.every(e => e.pinned);
    const label = allHttp ? 'request' : 'event';

    // selectedEvents is in selection order (most recent last).
    // Reverse so the most recent is the front card (index 0).
    const previewEvents = selectedEvents.slice(-PREVIEW_COUNT).reverse();

    const proButtons = <>
        <ActionButton
            title={isPaidUser ? `(${Ctrl}+M)` : 'Requires HTTP Toolkit Pro'}
            disabled={!isPaidUser || httpCount === 0}
            onClick={props.onBuildRule}
        >
            <Icon icon='Pencil' fixedWidth />
            Create {httpCount} Matching Rule{httpCount !== 1 ? 's' : ''}
        </ActionButton>
        <ActionButton
            title={isPaidUser
                ? 'Export selected exchanges as a HAR file'
                : 'With Pro: export as HAR'
            }
            disabled={!isPaidUser || count === 0}
            onClick={async () => {
                const harContent = JSON.stringify(
                    await generateHar(selectedEvents, { bodySizeLimit: Infinity })
                );
                const filename = `HTTPToolkit_${
                    dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
                }.har`;
                saveFile(filename, 'application/har+json;charset=utf-8', harContent);
            }}
        >
            <Icon icon={['fas', 'save']} fixedWidth />
            Export as HAR
        </ActionButton>
    </>;

    return <SummaryContainer>
        <PreviewStack>
            {previewEvents.map((event, index) => {
                return <PreviewRow
                    key={event.id}
                    index={index}
                    markerColor={getEventMarkerColor(event)}
                    dimRow={isOpaqueConnection(event)}
                >
                    {getEventPreviewContent(event)}
                </PreviewRow>;
            })}
            <SelectionLabel>
                {count} {label}{count !== 1 ? 's' : ''} selected
            </SelectionLabel>
        </PreviewStack>

        <ActionsContainer>
            <ActionButton
                title={`(${Ctrl}+P)`}
                onClick={props.onPin}
            >
                <PinIcon pinned={allPinned} fixedWidth />
                Toggle Pinning
            </ActionButton>
            <ActionButton
                title={`(${Ctrl}+Delete)`}
                onClick={props.onDelete}
            >
                <Icon icon={['far', 'trash-alt']} fixedWidth />
                Delete {count} {uppercaseFirst(label)}{count !== 1 ? 's' : ''}
            </ActionButton>

            { isPaidUser
                ? proButtons
                : <>
                    <ProDivider />
                    <ProActionsOverlay
                        getPro={props.accountStore!.getPro}
                        source='multi-selection-pane'
                    >
                        <ProActionsContainer>
                            {proButtons}
                        </ProActionsContainer>
                    </ProActionsOverlay>
                </>
            }
        </ActionsContainer>
    </SummaryContainer>;
}));
