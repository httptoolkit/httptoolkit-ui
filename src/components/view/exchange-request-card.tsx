import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { HttpExchange, Omit, HtkRequest } from '../../types';
import { styled } from '../../styles';
import { Icons, FontAwesomeIcon } from '../../icons';
import { ObservablePromise } from '../../util';

import { TrafficSource } from '../../model/sources';
import { getExchangeSummaryColour } from '../../exchange-colors';
import { ApiExchange } from '../../model/openapi';

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

const SourceIcon = ({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== Icons.Unknown ?
        <FontAwesomeIcon
            className={className}
            title={source.description}
            {...source.icon}
        /> : null;

const SmartViewToggle = styled.button`
    background: none;
    border: none;
    margin-right: auto;
    padding: 0;

    font-size: ${p => p.theme.textSize};
    font-weight: bold;
    font-family: ${p => p.theme.fontFamily};

    cursor: pointer;
    user-select: none;

    outline: none;
    &:focus {
        color: ${p => p.theme.popColor};
    }

    color: ${p => p.theme.containerBorder};
    &:[disabled] {
        color: ${p => p.theme.containerWatermark};
    }

    > svg {
        margin-right: 8px;
    }
`;

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
    position: absolute;
    top: 7px;
    right: 11px;
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
: null

const Undefined = styled((p) =>
    <span {...p}>[not set]</span>
)`
    font-style: italic;
    opacity: 0.5;
    margin-right: 10px;
`;

const ParamMetadata = styled.div`
    position: absolute;
    top: 10px;
    right: 15px;
    font-style: italic;
`;

const Description = styled.div`
    line-height: 1.2;

    p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, pre {
        margin-bottom: 10px;
    }

    ol, ul {
        padding-left: 20px;
    }

    ol {
        list-style: decimal;
    }

    ul {
        list-style: circle;
    }

    table {
        border-collapse: unset;
        border-spacing: 5px;
        margin-left: -5px;
    }

    th {
        min-width: 80px;
    }

    code {
        font-family: monospace;
    }

    h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-bottom: 10px;
    }

    pre {
        white-space: pre-wrap;
        display: block;
        border-left: 3px solid ${p => p.theme.containerWatermark};
        padding-left: 8px;
    }

    img {
        max-width: 100%;
    }

    :last-child :last-child {
        margin-bottom: 0;
    }
`

const ApiRequestDetails = (props: {
    api: ApiExchange
}) => {
    const { api } = props;
    const relevantParameters = api.parameters
        .filter((param) => !!param.value || param.required);

    return <>
        <CollapsibleSection prefix={false}>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Service:</ContentLabel> { api.serviceTitle }
                { !api.serviceDescription &&
                    <DocsLink href={api.serviceDocsUrl} />
                }
            </ExchangeCollapsibleSummary>

            { api.serviceDescription &&
                <ExchangeCollapsibleBody>
                    <ServiceLogo src={ api.serviceLogoUrl } alt='' />
                    <Description dangerouslySetInnerHTML={api.serviceDescription} />
                    <DocsLink href={api.serviceDocsUrl}>
                        Find out more
                    </DocsLink>
                </ExchangeCollapsibleBody>
            }
        </CollapsibleSection>

        <CollapsibleSection prefix={false}>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Operation:</ContentLabel> { api.operationName }
                { !api.operationDescription &&
                    <DocsLink href={api.operationDocsUrl} />
                }
            </ExchangeCollapsibleSummary>

            { api.operationDescription &&
                <ExchangeCollapsibleBody>
                    <Description dangerouslySetInnerHTML={api.operationDescription} />
                    <DocsLink href={api.operationDocsUrl}>
                        Find out more
                    </DocsLink>
                </ExchangeCollapsibleBody>
            }
        </CollapsibleSection>

        { relevantParameters.length > 1 &&
            <ContentLabelBlock>
                Parameters
            </ContentLabelBlock>
        }
        { relevantParameters.map((param) =>
            <CollapsibleSection prefix={true} key={param.name}>
                <ExchangeCollapsibleSummary>
                    { param.name }: { param.value || <Undefined /> }
                </ExchangeCollapsibleSummary>

                <ExchangeCollapsibleBody>
                    <div dangerouslySetInnerHTML={param.description} />
                    <ParamMetadata>
                        { param.required ? 'Required ' : 'Optional ' }
                        { param.in } parameter.
                    </ParamMetadata>
                </ExchangeCollapsibleBody>
            </CollapsibleSection>
        ) }
    </>;
}

const SmartRequestDetails = observer((p: {
    request: HtkRequest,
    apiExchange: ObservablePromise<ApiExchange> | undefined
}) => {
    return <div>
        { p.apiExchange && p.apiExchange.case({
            'fulfilled': (api) => <ApiRequestDetails api={api} />,
            'pending': () => <>
                <ContentLabel>Service:</ContentLabel>{' '}
                <FontAwesomeIcon spin icon={['fac', 'spinner-arc']} />
            </>,
            'rejected': () => null
        }) }

        <RawRequestDetails request={p.request} />
    </div>
});

interface ExchangeRequestCardProps extends Omit<ExchangeCardProps, 'children'>  {
    exchange: HttpExchange;
    apiExchange: ObservablePromise<ApiExchange> | undefined
}

@observer
export class ExchangeRequestCard extends React.Component<ExchangeRequestCardProps> {

    @observable
    smartView = true;

    render() {
        const { collapsed, exchange, apiExchange } = this.props;
        const { request } = exchange;

        return <ExchangeCard {...this.props} direction='right'>
            <header>
                { !collapsed &&
                    <SmartViewToggle onClick={this.toggleSmartView}>
                        <FontAwesomeIcon icon={[
                            'fas',
                            this.smartView ? 'toggle-on' : 'toggle-off'
                        ]} />
                        Smart View
                    </SmartViewToggle>
                }

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
                this.smartView ?
                    <SmartRequestDetails
                        request={request}
                        apiExchange={apiExchange}
                    /> :
                    <RawRequestDetails request={request} />
            }
        </ExchangeCard>
    }

    @action.bound
    toggleSmartView() {
        this.smartView = !this.smartView;
    }
}