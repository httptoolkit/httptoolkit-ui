import * as React from 'react';
import { action } from 'mobx';
import { observer } from 'mobx-react';

import { Omit, MockttpBreakpointRequestResult, RequestHeaders } from '../../types';
import { styled } from '../../styles';
import { SourceIcons, FontAwesomeIcon } from '../../icons';

import { HttpExchange } from '../../model/exchange';
import { TrafficSource } from '../../model/sources';
import { getExchangeSummaryColour } from '../../model/exchange-colors';

import {
    ExchangeCard,
    ExchangeCardProps,
} from './exchange-card';
import { Pill } from '../common/pill';
import { ContentLabelBlock } from '../common/text-content';
import {
    headersToHeadersArray,
    headersArrayToHeaders,
    HeadersArray,
    EditableHeaders
} from '../common/editable-headers';
import { TextInput } from '../common/inputs';

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== SourceIcons.Unknown ?
        <FontAwesomeIcon
            className={className}
            title={source.summary}
            {...source.icon}
        /> : null;

interface RequestBreakpointCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    onChange: (request: MockttpBreakpointRequestResult) => void;
}

const UrlInput = styled(TextInput)`
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 10px;
`;

@observer
export class ExchangeRequestBreakpointCard extends React.Component<RequestBreakpointCardProps> {

    render() {
        const { exchange, onChange, ...cardProps } = this.props;
        const { request } = exchange;

        const { inProgressResult } = this.props.exchange.requestBreakpoint!;
        const headers = headersToHeadersArray(inProgressResult.headers!);
        const { method, url } = inProgressResult;

        return <ExchangeCard {...cardProps} direction='right'>
            <header>
                <SourceIcon source={request.source} />
                <Pill color={getExchangeSummaryColour(exchange)}>
                    { method } {
                        (request.hostname || '')
                        // Add some tiny spaces to split up parts of the hostname
                        .replace(/\./g, '\u2008.\u2008')
                    }
                </Pill>
                <h1>Request</h1>
            </header>

            <ContentLabelBlock>URL</ContentLabelBlock>
            <UrlInput value={url} onChange={this.onUrlChanged} />

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <EditableHeaders
                headers={headers}
                onChange={this.onHeadersChanged}
            />
        </ExchangeCard>;
    }

    @action.bound
    onUrlChanged(event: React.ChangeEvent<HTMLInputElement>) {
        this.props.onChange(Object.assign({},
            this.props.exchange.requestBreakpoint!.inProgressResult,
            { url: event.target.value }
        ));
    }

    @action.bound
    onHeadersChanged(headers: HeadersArray) {
        this.props.onChange(Object.assign({},
            this.props.exchange.requestBreakpoint!.inProgressResult,
            {
                headers: headersArrayToHeaders(headers) as RequestHeaders
            }
        ));
    }

}