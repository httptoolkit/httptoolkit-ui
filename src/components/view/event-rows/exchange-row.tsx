import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { Icon, PhosphorIcon, WarningIcon } from '../../../icons';
import { HttpExchange } from '../../../types';
import {
    getSummaryColor,
    describeEventCategory
} from '../../../model/events/categorization';
import { areStepsModifying } from '../../../model/rules/rules';
import { nameStepClass } from '../../../model/rules/rule-descriptions';

import { StatusCode } from '../../common/status-code';
import { ViewEventContextMenuBuilder } from '../view-context-menu-builder';

type StatusValue = React.ComponentProps<typeof StatusCode>['status'];

function getExchangeStatus(exchange: HttpExchange): StatusValue {
    const { response } = exchange;
    if (response === 'aborted') return 'aborted';
    if (!response) return undefined; // Pending
    if (exchange.isWebSocket() && response.statusCode === 101) {
        return exchange.closeState ? 'WS:closed' : 'WS:open';
    }
    return response.statusCode;
}

import {
    TrafficEventListRow,
    RowPin,
    RowMarker,
    Method,
    Status,
    Source,
    Host,
    PathAndQuery,
    CommonRowProps,
    InlineStatus,
    SourceIcon,
    RowDetail
} from './event-row-components';

export const ExchangeRow = inject('uiStore')(observer((p: {
    rowProps: CommonRowProps,
    exchange: HttpExchange,
    contextMenuBuilder: ViewEventContextMenuBuilder
}) => {
    const { exchange, contextMenuBuilder } = p;
    const {
        request,
        response,
        pinned,
        category
    } = exchange;

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${_.startCase(exchange.category)} ${
                request.method
            } request ${
                response === 'aborted' || exchange.isWebSocket()
                    ? '' // Stated by the category already
                : exchange.downstream.isBreakpointed
                    ? 'waiting at a breakpoint'
                : !response
                    ? 'waiting for a response'
                // Actual response:
                    : `with a ${response.statusCode} response`
            } sent to ${
                // We include host+path but not protocol or search here, to keep this short
                request.parsedUrl.host + request.parsedUrl.pathname
            } by ${
                request.source.summary
            }`
        }
        {...p.rowProps}
        onContextMenu={contextMenuBuilder.getContextMenuCallback(exchange)}
    >
        <RowPin aria-label={pinned ? 'Pinned' : undefined} pinned={pinned}/>
        <RowMarker role='gridcell' category={category} title={describeEventCategory(category)} />
        <Method role='gridcell' pinned={pinned}>{ request.method }</Method>
        <Status role='gridcell'>
            {
                response === 'aborted'
                    ? <StatusCode status={'aborted'} />
                : exchange.downstream.isBreakpointed
                    ? <WarningIcon title='Breakpointed, waiting to be resumed' />
                : exchange.isWebSocket() && response?.statusCode === 101
                    ? <StatusCode // Special UI for accepted WebSockets
                        status={exchange.closeState
                            ? 'WS:closed'
                            : 'WS:open'
                        }
                        message={`${exchange.closeState
                            ? 'A closed'
                            : 'An open'
                        } WebSocket connection`}
                    />
                : <StatusCode
                    status={response?.statusCode}
                    message={response?.statusMessage}
                />
            }
        </Status>
        <Source role='gridcell'>
            <Icon
                title={request.source.summary}
                {...request.source.icon}
                fixedWidth={true}
            />
            {
                exchange.matchedRule &&
                areStepsModifying(exchange.matchedRule.stepTypes) &&
                <PhosphorIcon
                    icon='Pencil'
                    alt={`Handled by ${
                        exchange.matchedRule.stepTypes.length === 1
                        ? nameStepClass(exchange.matchedRule.stepTypes[0])
                        : 'multi-step'
                    } rule`}
                    size='20px'
                    color={getSummaryColor('mutative')}
                />
            }
        </Source>
        <Host role='gridcell' title={ request.parsedUrl.host }>
            { request.parsedUrl.host }
        </Host>
        <PathAndQuery role='gridcell' title={ request.parsedUrl.pathname + request.parsedUrl.search }>
            { request.parsedUrl.pathname + request.parsedUrl.search }
        </PathAndQuery>
    </TrafficEventListRow>;
}));

export function exchangePreviewContent(exchange: HttpExchange): React.ReactNode {
    const { method, source } = exchange.request;
    const { host, pathname, search } = exchange.request.parsedUrl;

    return <>
        <span>{method}</span>
        <InlineStatus status={getExchangeStatus(exchange)} />
        <SourceIcon {...source.icon} fixedWidth />
        <RowDetail>{host}{pathname}{search}</RowDetail>
    </>;
}
