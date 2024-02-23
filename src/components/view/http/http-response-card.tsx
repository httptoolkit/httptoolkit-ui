import * as _ from 'lodash';
import * as React from 'react';

import { inject, observer } from 'mobx-react';
import { get } from 'typesafe-get';

import { HtkResponse, Omit } from '../../../types';
import { Theme } from '../../../styles';

import { ApiExchange } from '../../../model/api/api-interfaces';
import { UiStore } from '../../../model/ui/ui-store';
import { getStatusColor } from '../../../model/events/categorization';
import { getStatusDocs, getStatusMessage } from '../../../model/http/http-docs';

import {
    CollapsibleCard,
    CollapsibleCardProps,
    CollapsibleCardHeading
} from '../../common/card';
import { Pill } from '../../common/pill';
import { HeaderDetails } from './header-details';
import { HeadersHeaderContextMenuBuilder, HeaderEvent } from './headers-context-menu-builder';
import {IEList, IncludeExcludeList} from '../../../model/IncludeExcludeList';
import {
} from '../../common/card';
import {
    CollapsibleSection,
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../../common/collapsible-section';
import {
    ContentLabel,
    ContentLabelBlock,
    ExternalContent,
    Markdown
} from '../../common/text-content';
import { DocsLink } from '../../common/docs-link';

interface HttpResponseCardProps extends CollapsibleCardProps  {
    theme: Theme;
    requestUrl: URL;
    uiStore?: UiStore;
    response: HtkResponse;
    apiExchange: ApiExchange | undefined;
}
const HeadersIncludeExcludeList = new IncludeExcludeList<string>();

export const HttpResponseCard = inject('uiStore') (observer((props: HttpResponseCardProps) => {
    const { response, requestUrl, theme, apiExchange } = props;

    const contextMenuBuilder = new HeadersHeaderContextMenuBuilder(
        props.uiStore!
    );

    const apiResponseDescription = get(apiExchange, 'response', 'description');
    const statusDocs = getStatusDocs(response.statusCode);

    const responseDetails = [
        apiResponseDescription && <ExternalContent
            key='api-response-docs'
            content={apiResponseDescription}
        />,
        statusDocs && <Markdown
            key='status-docs'
            content={statusDocs.summary}
        />,
        statusDocs && <p key='status-link'>
            <DocsLink href={statusDocs.url}>Find out more</DocsLink>
        </p>
    ].filter(d => !!d);

    return <CollapsibleCard {...props} direction='left'>
        <header>
            <Pill color={getStatusColor(response.statusCode, theme)}>{
                response.statusCode
            }</Pill>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Response
            </CollapsibleCardHeading>
        </header>

        <div>
            <CollapsibleSection>
                <CollapsibleSectionSummary>
                    <ContentLabel>Status:</ContentLabel>{' '}
                    {response.statusCode} {response.statusMessage || getStatusMessage(response.statusCode)}
                </CollapsibleSectionSummary>

                {
                    responseDetails.length ?
                        <CollapsibleSectionBody>
                            { responseDetails }
                        </CollapsibleSectionBody>
                    : null
                }
            </CollapsibleSection>
            <ContentLabelBlock  onContextMenu={contextMenuBuilder.getContextMenuCallback({HeadersIncludeExcludeList})}>Headers</ContentLabelBlock>
            <HeaderDetails headers={response.rawHeaders} requestUrl={requestUrl} HeadersIncludeExcludeList={HeadersIncludeExcludeList} uiStore={props.uiStore}  />
        </div>
    </CollapsibleCard>;
}));