import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { Icon } from '../../icons';
import { CollectedEvent } from '../../types';
import { getSummaryColor } from '../../model/events/categorization';

import { StatusCode } from '../common/status-code';

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
                opacity 0.15s ease-out,
                border-color 0.15s ease-out;
`;

const SourceIcon = styled(Icon)`
    flex-shrink: 0;
`;

const InlineStatus = styled(StatusCode)`
    flex-shrink: 0;
`;

const RowDetail = styled.span`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
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

// Renders preview content matching the list's column order. Similar but
// not identical to list rows (for starters, no column spacing).
function getPreviewContent(event: CollectedEvent): React.ReactNode {
    if (event.isHttp()) {
        const { method, source } = event.request;
        const { response } = event;
        const { host, pathname, search } = event.request.parsedUrl;
        const path = pathname + search;

        let status: React.ComponentProps<typeof StatusCode>['status'];
        if (response === 'aborted') {
            status = 'aborted';
        } else if (!response) {
            status = undefined; // Spinner
        } else if (event.isWebSocket() && response.statusCode === 101) {
            status = event.closeState ? 'WS:closed' : 'WS:open';
        } else {
            status = response.statusCode;
        }

        if (event.apiSpec?.isBuiltInApi && event.api?.matchedOperation()) {
            const opName = _.startCase(event.api.operation.name.replace('eth_', ''));
            return <>
                <span>{event.api.service.shortName}: {opName}</span>
                <SourceIcon {...source.icon} fixedWidth />
            </>;
        }

        return <>
            <span>{method}</span>
            <InlineStatus status={status} />
            <SourceIcon {...source.icon} fixedWidth />
            <RowDetail>{host}{path}</RowDetail>
        </>;
    } else if (event.isTlsFailure()) {
        const target = event.upstreamHostname || 'unknown domain';
        const desc = ({
            'closed': 'Aborted',
            'reset': 'Aborted',
            'unknown': 'Aborted',
            'cert-rejected': 'Certificate rejected for',
            'no-shared-cipher': 'HTTPS setup failed for',
        } as _.Dictionary<string>)[event.failureCause];
        return <RowDetail>{desc} connection to {target}</RowDetail>;
    } else if (event.isTlsTunnel()) {
        return <>
            {event.isOpen() && <InlineStatus status={undefined} />}
            <RowDetail>Tunnelled TLS to {event.upstreamHostname || 'unknown domain'}</RowDetail>
        </>;
    } else if (event.isRawTunnel()) {
        const target = event.upstreamHostname
            ? `${event.upstreamHostname}:${event.upstreamPort}`
            : 'unknown destination';
        return <>
            {event.isOpen() && <InlineStatus status={undefined} />}
            <RowDetail>Non-HTTP connection to {target}</RowDetail>
        </>;
    } else if (event.isRTCConnection()) {
        return <>
            {!event.closeState && <InlineStatus status={undefined} />}
            <span>WebRTC</span>
            <SourceIcon {...event.source.icon} fixedWidth />
            <RowDetail>{event.clientURL} → {event.remoteURL || '?'}</RowDetail>
        </>;
    } else if (event.isRTCDataChannel()) {
        return <>
            {!event.closeState && <InlineStatus status={undefined} />}
            <span>WebRTC Data</span>
            <SourceIcon {...event.rtcConnection.source.icon} fixedWidth />
            <RowDetail>{event.label}</RowDetail>
        </>;
    } else if (event.isRTCMediaTrack()) {
        return <>
            {!event.closeState && <InlineStatus status={undefined} />}
            <span>WebRTC Media</span>
            <SourceIcon {...event.rtcConnection.source.icon} fixedWidth />
            <RowDetail>{event.direction} {event.type}</RowDetail>
        </>;
    }
    return '';
}

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
                const isOpaqueConnection = event.isTlsFailure() ||
                    event.isTlsTunnel() ||
                    event.isRawTunnel();

                return <PreviewRow
                    key={event.id}
                    index={index}
                    markerColor={
                        isOpaqueConnection
                        ? 'transparent' // Ironic
                        : getSummaryColor(event.category)
                    }
                    dimRow={isOpaqueConnection}
                >
                    {getPreviewContent(event)}
                </PreviewRow>;
            })}
            <SelectionLabel>
                {count} {label}{count !== 1 ? 's' : ''} selected
            </SelectionLabel>
        </PreviewStack>
    </SummaryContainer>;
});
