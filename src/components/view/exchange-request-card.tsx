import * as React from 'react';
import { observer } from 'mobx-react';

import { Omit, HttpExchange, HtkRequest } from '../../types';
import { styled } from '../../styles';
import { SourceIcons, Icon } from '../../icons';

import { TrafficSource } from '../../model/http/sources';
import { getExchangeSummaryColour } from '../../model/http/exchange-colors';
import { getMethodDocs } from '../../model/http/http-docs';

import { CollapsibleCardHeading } from '../common/card';
import {
    ExchangeCard,
    ExchangeCardProps,
    ExchangeCollapsibleSummary,
    ExchangeCollapsibleBody
} from './exchange-card';
import { Pill } from '../common/pill';
import { CollapsibleSection } from '../common/collapsible-section';
import {
    ContentLabel,
    ContentLabelBlock,
    ContentMonoValue,
    Markdown
} from '../common/text-content';
import { DocsLink } from '../common/docs-link';
import { HeaderDetails } from './headers/header-details';
import { UrlBreakdown } from './url-breakdown';

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== SourceIcons.Unknown ?
        <Icon
            className={className}
            title={source.summary}
            {...source.icon}
        /> : null;

const UrlLabel = styled(ContentMonoValue)`
    display: inline;
`;

const RawRequestDetails = (p: { request: HtkRequest }) => {
    const methodDocs = getMethodDocs(p.request.method);
    const methodDetails = [
        methodDocs && <Markdown
            key='method-docs'
            content={methodDocs.summary}
        />,
        methodDocs && <p key='method-link'>
            <DocsLink href={methodDocs.url}>Find out more</DocsLink>
        </p>
    ].filter(d => !!d);

    return <div>
        <CollapsibleSection>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Method:</ContentLabel> { p.request.method }
            </ExchangeCollapsibleSummary>

            {
                methodDetails.length ?
                    <ExchangeCollapsibleBody>
                        { methodDetails }
                    </ExchangeCollapsibleBody>
                : null
            }
        </CollapsibleSection>

        <ContentLabelBlock>URL</ContentLabelBlock>

        <CollapsibleSection prefixTrigger={true}>
            <ExchangeCollapsibleSummary>
                <UrlLabel>{
                    p.request.parsedUrl.parseable
                        ? p.request.parsedUrl.toString()
                        : p.request.url
                }</UrlLabel>
            </ExchangeCollapsibleSummary>

            {
                <ExchangeCollapsibleBody>
                    <UrlBreakdown url={p.request.parsedUrl} />
                </ExchangeCollapsibleBody>
            }
        </CollapsibleSection>

        <ContentLabelBlock>Headers</ContentLabelBlock>
        <HeaderDetails headers={p.request.headers} requestUrl={p.request.parsedUrl} />
    </div>;
}

const WarningIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'exclamation-triangle']
}))`
    color: ${p => p.theme.warningColor};
    line-height: 1.2;

    &:not(:first-child) {
        margin-left: 9px;
    }

    &:not(:last-child) {
        margin-right: 9px;
    }
`;

interface ExchangeRequestCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
}

export const ExchangeRequestCard = observer((props: ExchangeRequestCardProps) => {
    const { exchange } = props;
    const { request } = exchange;

    return <ExchangeCard {...props} direction='right'>
        <header>
            <SourceIcon source={request.source} />
            <Pill color={getExchangeSummaryColour(exchange)}>
                { request.method } {
                    (request.hostname || '')
                    // Add some tiny spaces to split up parts of the hostname
                    .replace(/\./g, '\u2008.\u2008')
                }
            </Pill>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Request
            </CollapsibleCardHeading>
        </header>

        <RawRequestDetails request={request} />
    </ExchangeCard>;
});