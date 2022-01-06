import * as React from 'react';
import { action, computed } from 'mobx';
import { observer } from 'mobx-react';
import { Method } from 'mockttp';

import { Omit, BreakpointRequestResult, HttpExchange, Headers } from '../../types';
import { styled } from '../../styles';
import { SourceIcons, Icon } from '../../icons';

import { TrafficSource } from '../../model/http/sources';
import { getExchangeSummaryColour } from '../../model/http/exchange-colors';

import { CollapsibleCardHeading } from '../common/card';
import {
    ExchangeCard,
    ExchangeCardProps,
} from './exchange-card';
import { Pill } from '../common/pill';
import { ContentLabelBlock, ContentLabel } from '../common/text-content';
import { EditableHeaders } from '../common/editable-headers';
import { TextInput, Select } from '../common/inputs';

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== SourceIcons.Unknown ?
        <Icon
            className={className}
            title={source.summary}
            {...source.icon}
        /> : null;

interface RequestBreakpointCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    onChange: (request: Partial<BreakpointRequestResult>) => void;
}

const UrlInput = styled(TextInput)`
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 10px;
`;

type MethodName = keyof typeof Method;
const validMethods = Object.values(Method)
    .filter(
        value => typeof value === 'string'
    ) as Array<MethodName>;

const MethodSelect = styled(Select)`
    font-size: ${p => p.theme.textSize};
    display: inline-block;

    width: auto;
    margin-left: 10px;
    margin-bottom: 5px;
`;

@observer
export class ExchangeBreakpointRequestCard extends React.Component<RequestBreakpointCardProps> {

    render() {
        const { exchange, onChange, ...cardProps } = this.props;
        const { request } = exchange;

        const { inProgressResult } = this.props.exchange.requestBreakpoint!;
        const headers = inProgressResult.headers || {};
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
                <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                    Request
                </CollapsibleCardHeading>
            </header>

            <ContentLabel>Method:</ContentLabel>
            <MethodSelect value={method} onChange={this.onMethodChanged}>
                { !validMethods.includes(method as MethodName) &&
                    <option key={method} value={undefined}>
                        { method }
                    </option>
                }
                { validMethods.map((methodOption) =>
                    <option
                        key={methodOption}
                        value={methodOption}
                    >
                        { methodOption }
                    </option>
                ) }
            </MethodSelect>

            <ContentLabelBlock>URL</ContentLabelBlock>
            <UrlInput value={url} onChange={this.onUrlChanged} />

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <EditableHeaders
                headers={headers}
                onChange={this.onHeadersChanged}
            />
        </ExchangeCard>;
    }

    @computed
    get isHttp2() {
        return this.props.exchange.httpVersion === 2;
    }

    @action.bound
    onMethodChanged(event: React.ChangeEvent<HTMLSelectElement>) {
        const method = event.target.value;
        const { inProgressResult } = this.props.exchange.requestBreakpoint!;

        if (method === inProgressResult.method) return;

        if (this.isHttp2) {
            const headers = Object.assign({}, inProgressResult.headers, {
                ':method': method
            });
            this.props.onChange({ method, headers });
        } else {
            this.props.onChange({ method });
        }
    }

    @action.bound
    onUrlChanged(event: React.ChangeEvent<HTMLInputElement>) {
        const url = event.target.value;
        const { inProgressResult } = this.props.exchange.requestBreakpoint!;

        let headers = inProgressResult.headers;

        try {
            // Automatically update the host/H2 headers to match, if we can:
            const parsedUrl = new URL(url);

            if (this.isHttp2) {
                headers = Object.assign({}, headers);
                if (parsedUrl.host) headers[':authority'] = parsedUrl.host;
                if (parsedUrl.pathname) headers[':path'] = parsedUrl.pathname + (parsedUrl.search);
                if (parsedUrl.protocol) headers[':scheme'] = parsedUrl.protocol.slice(0, -1);
            } else if (parsedUrl.host) {
                headers = Object.assign({}, headers, { 'host': parsedUrl.host });
            }
        } catch (e) { }

        this.props.onChange({ url: event.target.value, headers });
    }

    @action.bound
    onHeadersChanged(headers: Headers) {
        this.props.onChange({ headers });
    }

}