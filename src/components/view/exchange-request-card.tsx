import * as React from 'react';
import { observer } from 'mobx-react';

import { Omit, HtkRequest, Html } from '../../types';
import { styled } from '../../styles';
import { Icons, FontAwesomeIcon } from '../../icons';

import { HttpExchange } from '../../model/exchange';
import { TrafficSource } from '../../model/sources';
import { getExchangeSummaryColour } from '../../exchange-colors';
import { ApiExchange, Parameter } from '../../model/openapi/openapi';

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
import { ExternalContent } from '../common/external-content';
import { DocsLink } from '../common/docs-link';
import { HeaderDetails } from './headers/header-details';

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== Icons.Unknown ?
        <FontAwesomeIcon
            className={className}
            title={source.summary}
            {...source.icon}
        /> : null;

const RawRequestDetails = (p: { request: HtkRequest }) => <div>
    <ContentLabelBlock>URL</ContentLabelBlock>
    <ContentMonoValue>{
        p.request.parsedUrl.toString()
    }</ContentMonoValue>

    <ContentLabelBlock>Headers</ContentLabelBlock>
    <HeaderDetails headers={p.request.headers} requestUrl={p.request.parsedUrl} />
</div>;

const ServiceLogo = styled(OptionalImage)`
    float: right;
    height: 26px;

    border: 4px solid #ffffff;
    border-radius: 2px;
`;

const ParametersGrid = styled.section`
    display: grid;
    grid-template-columns: 20px fit-content(40%) 1fr min-content;

    grid-gap: 5px 0;
    &:not(:last-child) {
        margin-bottom: 10px;
    }
`;

const ParameterKeyValue = styled(ExchangeCollapsibleSummary)`
    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;
    font-family: 'Fira Mono', monospace;
`;

const ParamName = styled.span`
    margin-right: 10px;
`;

const UnsetValue = styled.span`
    font-style: italic;
    opacity: 0.5;
    margin-right: 5px;
`;

const ParamMetadata = styled((p: {
    param: Parameter,
    className?: string
}) => <div className={p.className}>
        {
            [
                p.param.required ? 'Required' : 'Optional',
                p.param.type,
                p.param.in
            ]
            .filter((x) => !!x)
            .join(' ')
        } parameter
</div>)`
    line-height: 1.2;
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
    const setParameters = api.request.parameters
        .filter((param) => !!param.value || param.required || param.defaultValue);

    // If that leaves us with lots of parameters then ignore the ones that
    // are just unset default values.
    const relevantParameters = setParameters.length > 5 ?
        setParameters.filter((param) => !!param.value || param.required) :
        setParameters;

    const operationDetails = getDetailsWithWarnings(api.operation.description, api.operation.warnings);
    const hasOperationDetails = !!operationDetails.length;

    return <>
        <CollapsibleSection>
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

        <CollapsibleSection>
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

        { relevantParameters.length >= 1 && <>
            <ContentLabelBlock>
                Parameters
            </ContentLabelBlock>
            <ParametersGrid>
                { relevantParameters.map((param) =>
                    <CollapsibleSection withinGrid={true} key={param.name}>
                        <ParameterKeyValue>
                            <ParamName>{ param.name }: </ParamName>

                            <span>{ formatValue(param.value) ||
                                <UnsetValue>{
                                    param.defaultValue ?
                                        formatValue(param.defaultValue) + ' [default]' :
                                        '[not set]'
                                }</UnsetValue>
                            }</span>

                            { param.warnings.length ? <WarningIcon /> : <div/> }
                        </ParameterKeyValue>

                        <ExchangeCollapsibleBody>
                            { getDetailsWithWarnings(param.description, param.warnings) }
                            <ParamMetadata param={param}/>
                        </ExchangeCollapsibleBody>
                    </CollapsibleSection>
                ) }
            </ParametersGrid>
        </> }
    </>;
}

interface ExchangeRequestCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    apiExchange: ApiExchange | undefined
}

export const ExchangeRequestCard = observer((props: ExchangeRequestCardProps) => {
    const { exchange, apiExchange } = props;
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

        { apiExchange ? <ApiRequestDetails api={apiExchange} /> : null }
        <RawRequestDetails request={request} />
    </ExchangeCard>;
});