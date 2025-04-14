import * as React from 'react';
import { observer } from 'mobx-react';

import { HttpExchange, HtkRequest, HttpVersion, HttpExchangeView } from '../../../types';

import { getSummaryColor } from '../../../model/events/categorization';
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
    ContentMonoValueInline,
    Markdown
} from '../../common/text-content';
import { DocsLink } from '../../common/docs-link';
import { SourceIcon } from '../../common/source-icon';
import { HttpVersionPill } from '../../common/http-version-pill';
import { HeaderDetails } from './header-details';
import { UrlBreakdown } from '../url-breakdown';
import { HandlerClassKey } from '../../../model/rules/rules';
import { MatchedRulePill } from './matched-rule-pill';

const RawRequestDetails = (p: {
    request: HtkRequest,
    httpVersion: HttpVersion
}) => {
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
        <CollapsibleSection contentName={`${p.request.method} method documentation`}>
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

        <CollapsibleSection
            contentName='URL components'
            prefixTrigger={true}
        >
            <CollapsibleSectionSummary>
                <ContentMonoValueInline>{
                    p.request.parsedUrl.parseable
                        ? p.request.parsedUrl.toString()
                        : p.request.url
                }</ContentMonoValueInline>
            </CollapsibleSectionSummary>

            {
                <CollapsibleSectionBody>
                    <UrlBreakdown url={p.request.parsedUrl} />
                </CollapsibleSectionBody>
            }
        </CollapsibleSection>

        <ContentLabelBlock>Headers</ContentLabelBlock>
        <HeaderDetails
            httpVersion={p.httpVersion}
            headers={p.request.rawHeaders}
            requestUrl={p.request.parsedUrl}
        />
    </div>;
}

interface HttpRequestCardProps extends CollapsibleCardProps {
    exchange: HttpExchangeView;
    matchedRuleData: {
        stepTypes: HandlerClassKey[],
        status: 'unchanged' | 'modified-types' | 'deleted'
    } | undefined;
    onRuleClicked: () => void;
}

export const HttpRequestCard = observer((props: HttpRequestCardProps) => {
    const { exchange, matchedRuleData, onRuleClicked } = props;
    const { request } = exchange;

    // We consider passthrough as a no-op, and so don't show anything in that case.
    const noopRule = matchedRuleData?.stepTypes.every(
        type => type === 'passthrough' || type === 'ws-passthrough'
    )

    return <CollapsibleCard {...props} direction='right'>
        <header>
            { matchedRuleData && !noopRule &&
                <MatchedRulePill
                    ruleData={matchedRuleData}
                    onClick={onRuleClicked}
                />
            }
            <SourceIcon source={request.source} />
            <HttpVersionPill request={request} />
            <Pill color={getSummaryColor(exchange)}>
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

        <RawRequestDetails
            request={request}
            httpVersion={exchange.httpVersion}
        />
    </CollapsibleCard>;
});