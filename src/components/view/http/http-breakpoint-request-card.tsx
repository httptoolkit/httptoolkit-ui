import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer } from 'mobx-react';
import { Method } from 'mockttp';

import { BreakpointRequestResult, HttpExchange, RawHeaders } from '../../../types';
import { styled } from '../../../styles';

import { getSummaryColor } from '../../../model/events/categorization';
import { withHeaderValue } from '../../../model/http/headers';

import {
    CollapsibleCardHeading,
    CollapsibleCard,
    CollapsibleCardProps,
} from '../../common/card';
import { Pill } from '../../common/pill';
import { ContentLabelBlock, ContentLabel } from '../../common/text-content';
import { EditableRawHeaders } from '../../common/editable-headers';
import { TextInput, Select } from '../../common/inputs';
import { SourceIcon } from '../../common/source-icon';

interface RequestBreakpointCardProps extends CollapsibleCardProps {
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
    margin-left: 8px;
    margin-bottom: 5px;
`;

@observer
export class HttpBreakpointRequestCard extends React.Component<RequestBreakpointCardProps> {

    render() {
        const { exchange, onChange, ...cardProps } = this.props;
        const { request } = exchange;

        const { inProgressResult } = this.props.exchange.requestBreakpoint!;
        const headers = inProgressResult.rawHeaders || [];
        const { method, url } = inProgressResult;

        return <CollapsibleCard {...cardProps} direction='right'>
            <header>
                <SourceIcon source={request.source} />
                <Pill color={getSummaryColor(exchange)}>
                    { method } {
                        (request.parsedUrl.hostname || '')
                        // Add some tiny spaces to split up parts of the hostname
                        .replace(/\./g, '\u2008.\u2008')
                    }
                </Pill>
                <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                    Request
                </CollapsibleCardHeading>
            </header>

            <div>
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
            </div>

            <ContentLabelBlock>URL</ContentLabelBlock>
            <UrlInput value={url} onChange={this.onUrlChanged} />

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <EditableRawHeaders
                headers={headers}
                onChange={this.onHeadersChanged}
                preserveKeyCase={true}
            />
        </CollapsibleCard>;
    }

    @computed
    get hasPseudoHeaders() {
        return this.props.exchange.httpVersion >= 2;
    }

    @action.bound
    onMethodChanged(event: React.ChangeEvent<HTMLSelectElement>) {
        const method = event.target.value;
        const { inProgressResult } = this.props.exchange.requestBreakpoint!;

        if (method === inProgressResult.method) return;

        if (this.hasPseudoHeaders) {
            this.props.onChange({
                method,
                rawHeaders: withHeaderValue(inProgressResult.rawHeaders, { ':method': method })
            });
        } else {
            this.props.onChange({ method });
        }
    }

    @action.bound
    onUrlChanged(event: React.ChangeEvent<HTMLInputElement>) {
        const url = event.target.value;
        const { inProgressResult } = this.props.exchange.requestBreakpoint!;

        let rawHeaders = inProgressResult.rawHeaders;

        try {
            // Automatically update the host/H2 headers to match, if we can:
            const parsedUrl = new URL(url);

            if (this.hasPseudoHeaders) {
                rawHeaders = withHeaderValue(rawHeaders, {
                    ':authority': parsedUrl.host,
                    ':path': parsedUrl.pathname + parsedUrl.search,
                    ':scheme':  parsedUrl.protocol.slice(0, -1)
                });
            } else {
                rawHeaders = withHeaderValue(rawHeaders, { host: parsedUrl.host });
            }
        } catch (e) { }

        this.props.onChange({ url: event.target.value, rawHeaders });
    }

    @action.bound
    onHeadersChanged(rawHeaders: RawHeaders) {
        this.props.onChange({ rawHeaders });
    }

}