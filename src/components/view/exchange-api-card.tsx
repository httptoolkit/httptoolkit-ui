import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { IPromiseBasedObservable } from 'mobx-utils';

import { Omit, HttpExchange } from '../../types';
import { styled } from '../../styles';

import { ApiMetadata, parseExchange, ApiExchange } from '../../model/openapi';

import { ExchangeCardProps, ExchangeCard, ContentLabel, LoadingExchangeCard } from "./exchange-card";
import { FontAwesomeIcon } from '../../icons';

interface ApiCardProps extends Omit<ExchangeCardProps, 'children'> {
    api: IPromiseBasedObservable<ApiMetadata>;
    exchange: HttpExchange
}

const ApiLogo = styled.img`
    height: 26px;
    margin-right: auto;
`;

const ExchangeDetails = styled.section`
    font-size: ${p => p.theme.textSize};
    word-break: break-word;
`;

const OperationName = styled.h2`
    display: inline-block;
    font-weight: bold;
`;

const OperationSummary = styled.summary`
    cursor: pointer;
    user-select: none;

    &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }

    padding: 10px 5px 0;
    margin: -10px 0 0 -5px;

    > svg {
        color: ${p => p.theme.primaryInputColor};
    }
`;

const FullDetails = styled.div`
    padding-left: 10px;
    border-left: 4px solid ${p => p.theme.containerWatermark};
    font-style: italic;
    margin: 10px 0 20px;
`;

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

const ExchangeOperation = (props: {
    apiExchange: ApiExchange
}) => {
    const { apiExchange } = props;

    let docsLinkProps = apiExchange.operationDocsUrl ? {
        href: apiExchange.operationDocsUrl,
        target: '_blank',
        rel: 'noreferrer noopener'
    } : null;

    // All dangerous HTML should have been sanitized by fromMarkdown in model/openapi
    // TS enforces this, because we embed __html in the types themselves.

    return !!apiExchange.operationDescription ?
        <details>
            <OperationSummary>
                <OperationName dangerouslySetInnerHTML={apiExchange.operationName} />
            </OperationSummary>
            <FullDetails>
                <div dangerouslySetInnerHTML={apiExchange.operationDescription} />
                { docsLinkProps &&
                    <p>
                        <a {...docsLinkProps} >
                            Find out more <ExternalLinkIcon />
                        </a>
                    </p>
                }
            </FullDetails>
        </details>
    :
        <section>
            <OperationName dangerouslySetInnerHTML={apiExchange.operationName} />
            {' '}
            { docsLinkProps &&
                <a {...docsLinkProps}><ExternalLinkIcon /></a>
            }
        </section>
    ;
}

const ExchangeParameters = (props: {
    apiExchange: ApiExchange
}) => props.apiExchange.parameters.length ? <div>
    <ContentLabel>Parameters</ContentLabel>
    {
        props.apiExchange.parameters
        .filter((param) => !!param.value || param.required)
        .map((param) => <details>
            <summary>{ param.name }: { param.value }</summary>
            <FullDetails>
                <div dangerouslySetInnerHTML={param.description || { __html: '' }} />
                <p>Required?: { param.required.toString() }</p>
                <p>Deprecated?: { param.deprecated.toString() }</p>
            </FullDetails>
        </details>)
    }
</div> : null

export const ExchangeApiCard = observer((props: ApiCardProps) => {
    return props.api.case({
        fulfilled: (api) => {
            const apiExchange = parseExchange(api, props.exchange);

            return <ExchangeCard {...props}>

                <header>
                    <ApiLogo src={ apiExchange.serviceLogoUrl } alt='' />
                    <h1>{ apiExchange.serviceTitle }</h1>
                </header>

                <ExchangeDetails>
                    <ExchangeOperation apiExchange={apiExchange} />
                    <ExchangeParameters apiExchange={apiExchange} />
                </ExchangeDetails>

            </ExchangeCard>;
        },
        pending: () =>
            <LoadingExchangeCard {...props}>
                <h1>Loading API definition...</h1>
            </LoadingExchangeCard>,
        rejected: () => null,
    });
});