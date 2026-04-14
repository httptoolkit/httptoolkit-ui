import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { Icon } from '../../../icons';
import { HttpExchange } from '../../../types';
import { describeEventCategory } from '../../../model/events/categorization';

import { ViewEventContextMenuBuilder } from '../view-context-menu-builder';

import {
    TrafficEventListRow,
    RowPin,
    RowMarker,
    EventTypeColumn,
    Source,
    BuiltInApiRequestDetails,
    CommonRowProps,
    SourceIcon
} from './event-row-components';

export const BuiltInApiRow = observer((p: {
    rowProps: CommonRowProps,
    exchange: HttpExchange,
    contextMenuBuilder: ViewEventContextMenuBuilder
}) => {
    const {
        request,
        pinned,
        category
    } = p.exchange;
    const api = p.exchange.api!; // Only shown for built-in APIs, so this must be set

    const apiOperationName =  _.startCase(
        api.operation.name
        .replace('eth_', '') // One-off hack for Ethereum, but result looks much nicer.
    );

    const apiRequestDescription = api.request.parameters
        .filter(param => param.value !== undefined)
        .map(param => `${param.name}=${JSON.stringify(param.value)}`)
        .join(', ');

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${_.startCase(category)} ${
                api.service.shortName
            } ${
                apiOperationName
            }${
                apiRequestDescription
                ? ` with ${apiRequestDescription}`
                : ''
            } sent by ${
                request.source.summary
            }`
        }
        {...p.rowProps}
        onContextMenu={p.contextMenuBuilder.getContextMenuCallback(p.exchange)}
    >
        <RowPin pinned={pinned}/>
        <RowMarker role='gridcell' category={category} title={describeEventCategory(category)} />
        <EventTypeColumn role='gridcell'>
            { api.service.shortName }: { apiOperationName }
        </EventTypeColumn>
        <Source role='gridcell' title={request.source.summary}>
            <Icon
                {...request.source.icon}
                fixedWidth={true}
            />
        </Source>
        <BuiltInApiRequestDetails role='gridcell'>
            { apiRequestDescription }
        </BuiltInApiRequestDetails>
    </TrafficEventListRow>
});

export function builtInApiPreviewContent(exchange: HttpExchange): React.ReactNode {
    const { source } = exchange.request;
    const api = exchange.api!;
    const opName = _.startCase(api.operation.name.replace('eth_', ''));
    return <>
        <span>{api.service.shortName}: {opName}</span>
        <SourceIcon {...source.icon} fixedWidth />
    </>;
}
