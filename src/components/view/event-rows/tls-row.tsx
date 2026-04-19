import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { FailedTlsConnection, TlsTunnel } from '../../../types';

import {
    TlsListRow,
    ConnectedSpinnerIcon,
    CommonRowProps,
    InlineStatus,
    RowDetail
} from './event-row-components';

function getTlsDescription(tlsEvent: FailedTlsConnection | TlsTunnel): string {
    if (tlsEvent.isTlsTunnel()) return 'Tunnelled TLS';

    return ({
        'closed': 'Aborted',
        'reset': 'Aborted',
        'unknown': 'Aborted',
        'cert-rejected': 'Certificate rejected for',
        'no-shared-cipher': 'HTTPS setup failed for',
    } as _.Dictionary<string>)[tlsEvent.failureCause];
}

export const TlsRow = observer((p: {
    rowProps: CommonRowProps,
    tlsEvent: FailedTlsConnection | TlsTunnel
}) => {
    const { tlsEvent } = p;
    const description = getTlsDescription(tlsEvent);
    const connectionTarget = tlsEvent.upstreamHostname || 'unknown domain';

    return <TlsListRow
        role="row"
        aria-label={`${description} connection to ${connectionTarget}`}
        {...p.rowProps}
    >
        {
            tlsEvent.isTlsTunnel() &&
            tlsEvent.isOpen() &&
                <ConnectedSpinnerIcon />
        } {
            description
        } connection to { connectionTarget }
    </TlsListRow>
});

export function tlsPreviewContent(event: FailedTlsConnection | TlsTunnel): React.ReactNode {
    const description = getTlsDescription(event);
    const target = event.upstreamHostname || 'unknown domain';

    if (event.isTlsTunnel()) {
        return <>
            {event.isOpen() && <InlineStatus status={undefined} />}
            <RowDetail>{description} to {target}</RowDetail>
        </>;
    } else {
        return <RowDetail>{description} connection to {target}</RowDetail>;
    }
}
