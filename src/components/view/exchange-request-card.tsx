import * as React from 'react';
import { observer } from 'mobx-react';

import { Omit, HtkRequest, Html } from '../../types';
import { styled } from '../../styles';
import { Icons, FontAwesomeIcon } from '../../icons';

import { HttpExchange } from '../../model/exchange';
import { TrafficSource } from '../../model/sources';
import { getExchangeSummaryColour } from '../../exchange-colors';
import { ApiExchange } from '../../model/openapi/openapi';

import {
    ExchangeCard,
    ExchangeCardProps,
    ContentLabel,
    ContentLabelBlock,
    ContentMonoValue,
    ExchangeCollapsibleSummary,
    ExchangeCollapsibleBody
} from './exchange-card';
import { Pill } from '../common/pill';
import { CollapsibleSection } from '../common/collapsible-section';
import { OptionalImage } from '../common/optional-image';

import { HeaderDetails } from './header-details';
import { ExternalContent } from '../common/external-content';

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== Icons.Unknown ?
        <FontAwesomeIcon
            className={className}
            title={source.description}
            {...source.icon}
        /> : null;

const RawRequestDetails = (p: { request: HtkRequest }) => <div>
    <ContentLabelBlock>URL</ContentLabelBlock>
    <ContentMonoValue>{
        p.request.parsedUrl.toString()
    }</ContentMonoValue>

    <ContentLabelBlock>Headers</ContentLabelBlock>
    <ContentMonoValue>
        <HeaderDetails headers={p.request.headers} />
    </ContentMonoValue>
</div>;

const ExternalLinkIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'external-link-alt']
})`
    opacity: 0.5;
    margin-left: 5px;

    &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }
`;

const ServiceLogo = styled(OptionalImage)`
    float: right;
    height: 26px;

    border: 4px solid #ffffff;
    border-radius: 2px;
`;

const DocsLink = (p: {
    href?: string,
    children?: React.ReactNode
}) => p.href ?
    <a {...p} target='_blank' rel='noreferrer noopener'>
        { /* Whitespace after children, iff we have children */ }
        { p.children ? <>{ p.children } </> : null }
        <ExternalLinkIcon />
    </a>
: null;

const ParamName = styled.span`
    font-family: 'Fira Mono', monospace;
    word-break: break-all;
`;

const ParamValue = styled.span`
    font-family: 'Fira Mono', monospace;
    word-break: break-all;
`;

const UnsetValue = styled.span`
    font-style: italic;
    opacity: 0.5;
    margin-right: 5px;
`;

const ParamMetadata = styled.div`
    float: right;
    line-height: 1.2;
    padding: 0 0 10px 10px;
    font-style: italic;
`;

const WarningIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'exclamation-triangle']
})`
    color: #f1971f;
    line-height: 1.2;

    &:not(:first-child) {
        margin-left: 9px;
    }

    &:not(:last-child) {
        margin-right: 9px;
    }
`;

const Warning = styled((p) => <div {...p}>
    <WarningIcon /><span>{p.children}</span>
</div>)`
    color: ${p => p.theme.popColor};

    :not(:last-child) {
        margin-bottom: 10px;
    }
`;

function formatValue(value: unknown): string | undefined {
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString(10);
        if (typeof value === 'boolean') return value.toString();
        if (value == null) return undefined;
        else return JSON.stringify(value);
}

const getDetailsWithWarnings = (details: Html | undefined, warnings: string[]) => [
    warnings.length && warnings.map((warning, i) => <Warning key={warning}>{ warning }</Warning>),
    details && <ExternalContent key='details' content={details} />
].filter(d => !!d);

const ApiRequestDetails = (props: {
    api: ApiExchange
}) => {
    const { api } = props;
    const relevantParameters = api.request.parameters
        .filter((param) => !!param.value || param.required);

    const operationDetails = getDetailsWithWarnings(api.operation.description, api.operation.warnings);
    const hasOperationDetails = !!operationDetails.length;

    return <>
        <CollapsibleSection prefix={false}>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Service:</ContentLabel> { api.service.name }
                { !api.service.description &&
                    <DocsLink href={api.service.docsUrl} />
                }
            </ExchangeCollapsibleSummary>

            { api.service.description &&
                <ExchangeCollapsibleBody>
                    <ServiceLogo src={ api.service.logoUrl } alt='' />
                    <ExternalContent content={api.service.description} />
                    <DocsLink href={api.service.docsUrl}>
                        Find out more
                    </DocsLink>
                </ExchangeCollapsibleBody>
            }
        </CollapsibleSection>

        <CollapsibleSection prefix={false}>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Operation:</ContentLabel> { api.operation.name }
                { !hasOperationDetails &&
                    <DocsLink href={api.operation.docsUrl} />
                }
                { api.operation.warnings.length ? <WarningIcon /> : null }
            </ExchangeCollapsibleSummary>

            { hasOperationDetails &&
                <ExchangeCollapsibleBody>
                    { operationDetails }
                    <DocsLink href={api.operation.docsUrl}>
                        Find out more
                    </DocsLink>
                </ExchangeCollapsibleBody>
            }
        </CollapsibleSection>

        { relevantParameters.length >= 1 &&
            <ContentLabelBlock>
                Parameters
            </ContentLabelBlock>
        }
        { relevantParameters.map((param) =>
            <CollapsibleSection prefix={true} key={param.name}>
                <ExchangeCollapsibleSummary>
                    <ParamName>{ param.name }: </ParamName>
                    <ParamValue>
                        { formatValue(param.value) ||
                            <UnsetValue>{
                                param.defaultValue ?
                                    formatValue(param.defaultValue) + ' [default]' :
                                    '[not set]'
                            }</UnsetValue>
                        }
                    </ParamValue>
                    { param.warnings.length ? <WarningIcon /> : null }
                </ExchangeCollapsibleSummary>

                <ExchangeCollapsibleBody>
                    <ParamMetadata>
                        { param.required ? 'Required ' : 'Optional ' }
                        { param.in } parameter
                    </ParamMetadata>
                    { getDetailsWithWarnings(param.description, param.warnings) }
                </ExchangeCollapsibleBody>
            </CollapsibleSection>
        ) }
    </>;
}

const SmartRequestDetails = observer((p: {
    request: HtkRequest,
    apiExchange: ApiExchange | undefined
}) => {
    return <div>
        { p.apiExchange && <ApiRequestDetails api={p.apiExchange} /> }
        <RawRequestDetails request={p.request} />
    </div>
});

interface ExchangeRequestCardProps extends Omit<ExchangeCardProps, 'children'>  {
    isPaidUser: boolean;
    exchange: HttpExchange;
    apiExchange: ApiExchange | undefined
}

export const ExchangeRequestCard = observer((props: ExchangeRequestCardProps) => {
    const { isPaidUser, exchange, apiExchange } = props;
    const { request } = exchange;

    return <ExchangeCard {...props} direction='right'>
        <header>
            <SourceIcon source={request.source} />
            <Pill color={getExchangeSummaryColour(exchange)}>
                { request.method } {
                    request.hostname
                    // Add some tiny spaces to split up parts of the hostname
                    .replace(/\./g, '\u2008.\u2008')
                }
            </Pill>
            <h1>Request</h1>
        </header>
        {
            isPaidUser ?
                <SmartRequestDetails
                    request={request}
                    apiExchange={apiExchange}
                /> :
                <RawRequestDetails request={request} />
        }
    </ExchangeCard>;
});