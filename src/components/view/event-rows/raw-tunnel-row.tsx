import * as React from 'react';
import { observer } from 'mobx-react';

import { RawTunnel } from '../../../types';

import {
    TlsListRow,
    ConnectedSpinnerIcon,
    CommonRowProps,
    InlineStatus,
    RowDetail
} from './event-row-components';

function getConnectionTarget(event: RawTunnel): string {
    return event.upstreamHostname
        ? `${event.upstreamHostname}:${event.upstreamPort}`
        : 'unknown destination';
}

export const RawTunnelRow = observer((p: {
    rowProps: CommonRowProps,
    event: RawTunnel
}) => {
    const { event } = p;
    const target = getConnectionTarget(event);

    return <TlsListRow
        role="row"
        aria-label={`Non-HTTP connection to ${target}`}
        {...p.rowProps}
    >
        {
            event.isOpen() &&
                <ConnectedSpinnerIcon />
        } Non-HTTP connection to { target }
    </TlsListRow>
});

export function rawTunnelPreviewContent(event: RawTunnel): React.ReactNode {
    const target = getConnectionTarget(event);
    return <>
        {event.isOpen() && <InlineStatus status={undefined} />}
        <RowDetail>Non-HTTP connection to {target}</RowDetail>
    </>;
}
