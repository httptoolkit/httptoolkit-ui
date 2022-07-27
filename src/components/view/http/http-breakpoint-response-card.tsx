import * as React from 'react';
import { action } from 'mobx';
import { observer } from 'mobx-react';

import { Omit, BreakpointResponseResult, HttpExchange, Headers } from '../../../types';
import { styled, Theme } from '../../../styles';

import { getStatusColor } from '../../../model/events/categorization';

import {
    CollapsibleCardHeading,
    CollapsibleCard,
    CollapsibleCardProps,
} from '../../common/card';
import { Pill } from '../../common/pill';
import { ContentLabelBlock, ContentLabel } from '../../common/text-content';
import { EditableHeaders } from '../../common/editable-headers';
import { EditableStatus } from '../../common/editable-status';

interface ResponseBreakpointCardProps extends CollapsibleCardProps {
    theme: Theme;
    exchange: HttpExchange;
    onChange: (response: Partial<BreakpointResponseResult>) => void;
}

const StatusContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: baseline;
`;

const InlineEditableStatus = styled(EditableStatus)`
    margin-left: 10px;
    margin-bottom: 5px;
    flex-basis: 100%;
`;

@observer
export class HttpBreakpointResponseCard extends React.Component<ResponseBreakpointCardProps> {

    render() {
        const { exchange, onChange, theme, ...cardProps } = this.props;

        const { inProgressResult } = exchange.responseBreakpoint!;
        const headers = inProgressResult.headers || {};
        const { statusCode, statusMessage } = inProgressResult;

        return <CollapsibleCard {...cardProps} direction='left'>
            <header>
                <Pill color={getStatusColor(inProgressResult.statusCode, theme!)}>{ statusCode }</Pill>
                <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                    Response
                </CollapsibleCardHeading>
            </header>

            <StatusContainer>
                <ContentLabel>Status:</ContentLabel>
                <InlineEditableStatus
                    httpVersion={exchange.httpVersion}
                    statusCode={statusCode}
                    statusMessage={statusMessage}
                    onChange={this.onStatusChange}
                />
            </StatusContainer>

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <EditableHeaders
                headers={headers}
                onChange={this.onHeadersChanged}
            />
        </CollapsibleCard>;
    }

    @action.bound
    onHeadersChanged(headers: Headers) {
        this.props.onChange({ headers });
    }

    @action.bound
    onStatusChange(statusCode: number | undefined, statusMessage: string | undefined) {
        if (this.props.exchange.httpVersion === 2) {
            const headers = Object.assign({},
                this.props.exchange.responseBreakpoint!.inProgressResult.headers,
                { ':status': statusCode?.toString() ?? '' }
            );
            this.props.onChange({ statusCode: statusCode || NaN, statusMessage, headers });
        } else {
            this.props.onChange({ statusCode: statusCode || NaN, statusMessage });
        }
    }

}