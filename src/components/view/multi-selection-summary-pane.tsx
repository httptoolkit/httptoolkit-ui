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
import { ZipExportDialog } from './zip-export-dialog';

const SummaryContainer = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    padding: 0 20px 20px;
    height: 100%;
`;

const PreviewStack = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    padding: 20px 0 0;
    width: 100%;
`;

const PreviewRow = styled.div<{
    index: number,
    markerColor: string,
    dimRow: boolean
}>`
    background-color: ${p => p.theme.mainBackground};
    border-left: 5px solid ${p => p.markerColor};
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    border-radius: 0 4px 4px 0;

    width: calc(100% - ${p => p.index * 20}px);
    margin-top: ${p => p.index === 0 ? '0' : '-4px'};
    padding: 8px 12px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    font-size: ${p => p.theme.textSize};

    ${p => p.dimRow && css`
        opacity: 0.6;
    `}
`;

const SelectionLabel = styled.div`
    margin-top: 20px;
    font-size: ${p => p.theme.headingSize};
    font-weight: bold;
`;

const ActionsContainer = styled.div`
    width: 100%;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const ActionButton = styled(Button)<{
    disabled?: boolean
}>`
    font-size: ${p => p.theme.textSize};
    padding: 8px 16px;
    width: 100%;
    font-weight: bold;

    display: flex;
    align-items: center;
    gap: 10px;

    ${p => p.disabled && css`
        opacity: 0.5;
    `}

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
    border-top: 1px solid ${p => p.theme.containerBorder};
`;

const ProActionsOverlay = styled(GetProOverlay)`
    width: 100%;
`;

const ProActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;

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
    const [zipDialogEvents, setZipDialogEvents] = React.useState<ReadonlyArray<CollectedEvent> | null>(null);

    const { selectedEvents } = props;
    const count = selectedEvents.length;
    const isPaidUser = props.accountStore!.user.isPaidUser();

    const exportableEvents = selectedEvents.filter(e =>
        e.isHttp() && !e.isWebSocket()
    );
    const httpCount = exportableEvents.length;

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
        <ActionButton
            title={isPaidUser
                ? 'Export selected exchanges as a ZIP (HAR + snippets + manifest)'
                : 'With Pro: export as ZIP'
            }
            disabled={!isPaidUser || httpCount === 0}
            onClick={() => setZipDialogEvents(exportableEvents)}
        >
            <Icon icon={['fas', 'file-archive']} fixedWidth />
            Export as ZIP
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

        {zipDialogEvents && <ZipExportDialog
            events={zipDialogEvents}
            onClose={() => setZipDialogEvents(null)}
            titleSuffix={`${zipDialogEvents.length} request${zipDialogEvents.length !== 1 ? 's' : ''}`}
        />}
    </SummaryContainer>;
}));
