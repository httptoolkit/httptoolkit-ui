import * as React from 'react';
import { observer } from 'mobx-react';

import { Html } from '../../../types';
import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import { joinAnd } from '../../../util/text';

import { ApiExchange, ApiParameter } from '../../../model/api/api-interfaces';

import {
    CollapsibleCardHeading,
    CollapsibleCard,
    CollapsibleCardProps
} from '../../common/card';
import {
    CollapsibleSection,
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../../common/collapsible-section';
import { OptionalImage } from '../../common/optional-image';
import {
    ContentLabel,
    ContentLabelBlock,
    ExternalContent
} from '../../common/text-content';
import { DocsLink } from '../../common/docs-link';
import { CardSalesPitch, ProHeaderPill } from '../../account/pro-placeholders';

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

const ParameterKeyValue = styled(CollapsibleSectionSummary)`
    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;
    font-family: ${p => p.theme.monoFontFamily};
    line-height: 1.1;
`;

const ParamName = styled.span`
    margin-right: 10px;
`;

const UnsetValue = styled.span`
    font-style: italic;
    opacity: ${p => p.theme.lowlightTextOpacity};
    margin-right: 5px;
`;

const ParamMetadata = styled((p: {
    param: ApiParameter,
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
        {
            p.param.defaultValue !== undefined ?
                `. Defaults to ${p.param.defaultValue}`
                : ''
        }
        {
            p.param.enum !== undefined && p.param.enum.length > 0 ?
                <>
                    .<br/>
                    Valid values: {joinAnd(
                        p.param.enum.map(v => JSON.stringify(v))
                    )}
                </>
                : ''
        }.
</div>)`
    font-style: italic;
`;

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
    details && <ExternalContent key='details' htmlContent={details} />
].filter(d => !!d);


const ObjectParamContainer = styled.div`
    display: grid;
    grid-template-columns: fit-content(30%) auto;
    grid-gap: 5px;
    margin-bottom: 10px;
`;

const ObjectParamKey = styled.div`
    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
    text-align: right;
`;

const ObjectParamValue = styled.pre`
    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
    white-space: pre-wrap;
`;

const ObjectParamDetails = (p: { value: object }) => <ObjectParamContainer>{
    Object.entries(p.value).map(([key, value], i) => [
        <ObjectParamKey key={`${i}-key`}>{ key }:</ObjectParamKey>,
        <ObjectParamValue key={`${i}-value`}>{ value }</ObjectParamValue>
    ])
}</ObjectParamContainer>;

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
            <CollapsibleSectionSummary>
                <ContentLabel>Service:</ContentLabel> { api.service.name }
                { !api.service.description &&
                    <DocsLink href={api.service.docsUrl} />
                }
            </CollapsibleSectionSummary>

            { api.service.description &&
                <CollapsibleSectionBody>
                    <ServiceLogo src={ api.service.logoUrl } alt='' />
                    <ExternalContent htmlContent={api.service.description} />
                    <DocsLink href={api.service.docsUrl}>
                        Find out more
                    </DocsLink>
                </CollapsibleSectionBody>
            }
        </CollapsibleSection>

        <CollapsibleSection>
            <CollapsibleSectionSummary>
                <ContentLabel>Operation:</ContentLabel> { api.operation.name }
                { !hasOperationDetails &&
                    <DocsLink href={api.operation.docsUrl} />
                }
                { api.operation.warnings.length ? <WarningIcon /> : null }
            </CollapsibleSectionSummary>

            { hasOperationDetails &&
                <CollapsibleSectionBody>
                    { operationDetails }
                    <DocsLink href={api.operation.docsUrl}>
                        Find out more
                    </DocsLink>
                </CollapsibleSectionBody>
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

                        <CollapsibleSectionBody>
                            { getDetailsWithWarnings(param.description, param.warnings) }
                            { param.type === 'object' && Object.keys(param).length > 1
                                ? <ObjectParamDetails value={param.value as object} />
                                : null
                            }
                            <ParamMetadata param={param}/>
                        </CollapsibleSectionBody>
                    </CollapsibleSection>
                ) }
            </ParametersGrid>
        </> }
    </>;
}

interface HttpApiCardProps extends CollapsibleCardProps {
    apiName: string;
    apiExchange: ApiExchange
}

export const HttpApiCard = observer((props: HttpApiCardProps) => {
    const { apiName, apiExchange } = props;

    return <CollapsibleCard {...props}>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                { apiName }
            </CollapsibleCardHeading>
        </header>

        <ApiRequestDetails api={apiExchange} />
    </CollapsibleCard>;
});

interface HttpApiPlaceholderCardProps extends CollapsibleCardProps {
    apiName: string;
}

export const HttpApiPlaceholderCard = observer((props: HttpApiPlaceholderCardProps) => {
    const { apiName } = props;

    return <CollapsibleCard {...props}>
        <header>
            <ProHeaderPill />

            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                { apiName }
            </CollapsibleCardHeading>
        </header>

        <CardSalesPitch source='api'>
            <p>
                HTTP Toolkit Pro can show you more information about this API.
            </p>
            <p>
                Instantly understand this request with inline documentation for the
                endpoint, parameters, and responses.
            </p>
            <p>
                Automatically validate that this request &amp; its body match the API
                schema. See all the parameters that you're <em>not</em> sending too,
                and their default values, and get warned about deprecated or invalid
                endpoints and parameters.
            </p>
        </CardSalesPitch>
    </CollapsibleCard>;
});