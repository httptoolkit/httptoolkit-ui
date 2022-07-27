import * as React from 'react';
import { observer } from 'mobx-react';

import { Omit, HttpExchange, HtkRequest } from '../../../types';
import { styled } from '../../../styles';
import { SourceIcons, Icon } from '../../../icons';

import { TrafficSource } from '../../../model/http/sources';
import { getSummaryColour } from '../../../model/events/categorization';
import { getMethodDocs } from '../../../model/http/http-docs';

import {
    CollapsibleCardHeading,
    CollapsibleCard,
    CollapsibleCardProps
} from '../../common/card';
import { Pill } from '../../common/pill';
import {
    CollapsibleSection,
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../../common/collapsible-section';
import {
    ContentLabel,
    ContentLabelBlock,
    ContentMonoValue,
    Markdown
} from '../../common/text-content';
import { DocsLink } from '../../common/docs-link';
import { HeaderDetails } from './header-details';
import { UrlBreakdown } from '../url-breakdown';

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
            <CollapsibleSectionSummary>
                <ContentLabel>Method:</ContentLabel> { p.request.method }
            </CollapsibleSectionSummary>

            {
                methodDetails.length ?
                    <CollapsibleSectionBody>
                        { methodDetails }
                    </CollapsibleSectionBody>
                : null
            }
        </CollapsibleSection>

        <ContentLabelBlock>URL</ContentLabelBlock>

        <CollapsibleSection prefixTrigger={true}>
            <CollapsibleSectionSummary>
                <UrlLabel>{
                    p.request.parsedUrl.parseable
                        ? p.request.parsedUrl.toString()
                        : p.request.url
                }</UrlLabel>
            </CollapsibleSectionSummary>

            {
                <CollapsibleSectionBody>
                    <UrlBreakdown url={p.request.parsedUrl} />
                </CollapsibleSectionBody>
            }
        </CollapsibleSection>

        <ContentLabelBlock>Headers</ContentLabelBlock>
        <HeaderDetails headers={p.request.headers} requestUrl={p.request.parsedUrl} />
    </div>;
}

interface HttpRequestCardProps extends CollapsibleCardProps {
    exchange: HttpExchange;
}

export const HttpRequestCard = observer((props: HttpRequestCardProps) => {
    const { exchange } = props;
    const { request } = exchange;

    return <CollapsibleCard {...props} direction='right'>
        <header>
            <SourceIcon source={request.source} />
            <Pill color={getSummaryColour(exchange)}>
                { exchange.isWebSocket() ? 'WebSocket ' : '' }
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
    </CollapsibleCard>;
});