import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { CollectedEvent } from '../../types';

import { getEventPreviewContent, getEventMarkerColor, isOpaqueConnection } from './event-rows/event-row';

const SummaryContainer = styled.div`
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

const PREVIEW_COUNT = 10;

export const MultiSelectionSummaryPane = observer((props: {
    selectedEvents: ReadonlyArray<CollectedEvent>
}) => {
    const { selectedEvents } = props;
    const count = selectedEvents.length;

    const allHttp = count > 0 && selectedEvents.every(e => e.isHttp());
    const label = allHttp ? 'request' : 'event';

    // selectedEvents is in selection order (most recent last).
    // Reverse so the most recent is the front card (index 0).
    const previewEvents = selectedEvents.slice(-PREVIEW_COUNT).reverse();

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
    </SummaryContainer>;
});
