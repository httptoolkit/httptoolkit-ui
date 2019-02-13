import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { IPromiseBasedObservable } from 'mobx-utils';
import { OperationObject } from 'openapi-directory';

import { Omit, HttpExchange } from '../../types';
import { styled } from '../../styles';

import { ApiMetadata, getPath } from '../../model/openapi';

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

const OperationDefinition = styled.section`
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

    padding: 10px 5px;
    margin: -10px 0 0 -5px;

    > svg {
        color: ${p => p.theme.primaryInputColor};
    }
`;

const OperationDetails = styled.p`
    padding-left: 10px;
    border-left: 4px solid ${p => p.theme.containerWatermark};
    font-style: italic;
    margin: 10px 0 20px;
`;

const OperationDocs = styled.a`
    display: block;
    margin-top: 10px;
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

export const ExchangeOperationDetails = (props: {
    exchange: HttpExchange,
    api: ApiMetadata
}) => {
    const { exchange, api } = props;

    const path = getPath(api, props.exchange);
    if (!path) return null;

    const operation: OperationObject | undefined = path[exchange.request.method.toLowerCase()];
    if (!operation) return <OperationName>Unknown endpoint</OperationName>;

    let operationDetails = operation.description || path.description;

    // Some specs use the same text for summary and description, so we
    // fallback to the bare op id in that case
    let operationName = operation.summary !== operationDetails ?
        operation.summary : operation.operationId;

    let docsUrl: string | undefined = (
        operation.externalDocs || api.spec.externalDocs || { } as any
    ).url;

    let docsLinkProps = docsUrl ? {
        href: docsUrl,
        target: '_blank',
        rel: 'noreferrer noopener'
    } : {};

    return !!operationDetails ?
        <OperationDefinition as={'details'}>
            <OperationSummary>
                <OperationName>{ operationName }</OperationName>
            </OperationSummary>
            <OperationDetails>
                { operationDetails }
                { docsUrl &&
                    <OperationDocs {...docsLinkProps} >
                        Find out more <ExternalLinkIcon />
                    </OperationDocs>
                }
            </OperationDetails>
        </OperationDefinition>
    :
        <OperationDefinition>
            <OperationName>
                { operationName }
            </OperationName>
            {' '}
            { docsUrl &&
                <a {...docsLinkProps}><ExternalLinkIcon /></a>
            }
        </OperationDefinition>
    ;
}

export const ExchangeApiCard = observer((props: ApiCardProps) => {
    return props.api.case({
        fulfilled: (api) =>
            <ExchangeCard {...props}>

                <header>
                    <ApiLogo src={api.spec.info['x-logo'].url} alt='' />
                    <h1>{ api.spec.info.title }</h1>
                </header>

                <div>
                    <ExchangeOperationDetails exchange={props.exchange} api={api} />
                </div>

            </ExchangeCard>,
        pending: () =>
            <LoadingExchangeCard {...props}>
                <h1>Loading API definition...</h1>
            </LoadingExchangeCard>,
        rejected: () => null,
    });
});