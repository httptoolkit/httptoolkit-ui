import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../../styles';
import { RawHeaders } from '../../../types';

import { getHeaderDocs } from '../../../model/http/http-docs';
import { AccountStore } from '../../../model/account/account-store';

import { CollapsibleSection } from '../../common/collapsible-section';
import { DocsLink } from '../../common/docs-link';
import { BlankContentPlaceholder } from '../../common/text-content';
import {
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../../common/collapsible-section';

import { CookieHeaderDescription } from './set-cookie-header-description';
import { UserAgentHeaderDescription } from './user-agent-header-description';
import { IEList, IncludeExcludeList } from '../../../model/IncludeExcludeList';
import { HeadersContextMenuBuilder } from './headers-context-menu-builder';
import { filterProps } from '../../component-utils';
import { ArrowIcon, Icon, WarningIcon } from '../../../icons';
import { UiStore } from '../../../model/ui/ui-store';

const HeadersGrid = styled.section`
    display: grid;
    grid-template-columns: 20px fit-content(30%) 1fr;

    grid-gap: 5px 0;
    &:not(:last-child) {
        margin-bottom: 10px;
    }
`;

const HeaderKeyValue = styled(CollapsibleSectionSummary)`
    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;
    font-family: ${p => p.theme.monoFontFamily};
    line-height: 1.1;
`;

const HeaderName = styled.span`
    margin-right: 10px;
`;

const HeaderDescriptionContainer = styled(CollapsibleSectionBody)`
    line-height: 1.3;
`;

const HeaderDocsLink = styled(DocsLink)`
    display: block;
    margin-top: 10px;
`;

const getHeaderDescription = (
    name: string,
    value: string,
    requestUrl: URL,
    isPaidUser: boolean
) => {
    name = name.toLowerCase();

    if (isPaidUser) {
        if (name === 'set-cookie') {
            return <CookieHeaderDescription
                value={value}
                requestUrl={requestUrl}
            />;
        } else if (name === 'user-agent') {
            return <UserAgentHeaderDescription
                value={value}
            />;
        }
    }

    const headerDocs = getHeaderDocs(name)?.summary;

    return headerDocs && <p>
        { headerDocs }
    </p>
};


const RowPin = styled(
    filterProps(Icon, 'pinned')
).attrs((p: { pinned: boolean }) => ({
    icon: ['fas', 'thumbtack'],
    title: p.pinned ? "This header is pinned, it will appear at the top of the list by default" : ''
}))`
    font-size: 90%;
    background-color: ${p => p.theme.containerBackground};
    /* Without this, 0 width pins create a large & invisible but still clickable icon */
    overflow: hidden;
    transition: width 0.1s, padding 0.1s, margin 0.1s;
    ${(p: { pinned: boolean }) =>
        p.pinned
            ? `
            width: auto;
            padding: 4px;
            height: 40%;
            && { margin-right: -3px; }
        `
            : `
            padding: 0px 0;
            width: 0 !important;
            margin: 0 !important;
        `
    }
`;

export const HeaderDetails = inject('accountStore', 'uiStore')(observer((props: {
    headers: RawHeaders,
    requestUrl: URL,
    HeadersIncludeExcludeList: IncludeExcludeList<string>,
    accountStore?: AccountStore,
    uiStore?: UiStore
}) => {
    const contextMenuBuilder = new HeadersContextMenuBuilder(
        props.accountStore!,
        props.uiStore!
    );
    const filtered = props.HeadersIncludeExcludeList.FilterArrayAgainstList(_.sortBy(props.headers, ([key]) => key.toLowerCase()), IEList.Favorite, true, ([key]) => key);
    const sortedHeaders = Array.from(props.HeadersIncludeExcludeList.SortArrayAgainstList(filtered, IEList.Favorite, ([key]) => key));
    let hiddenCount = props.headers.length - sortedHeaders.length;


    return sortedHeaders.length === 0 ?
        <BlankContentPlaceholder>(None)</BlankContentPlaceholder>
    :
        <HeadersGrid>
            { _.flatMap(sortedHeaders, ([key, value], i) => {
                const docs = getHeaderDocs(key);
                const description = getHeaderDescription(
                    key,
                    value,
                    props.requestUrl,
                    props.accountStore!.isPaidUser
                )

                return <CollapsibleSection withinGrid={true} key={`${key}-${i}`}>
                    <HeaderKeyValue onContextMenu={contextMenuBuilder.getContextMenuCallback({ header_name: key, header_value: [value], HeadersIncludeExcludeList: props.HeadersIncludeExcludeList })}>
                        <HeaderName><RowPin pinned={props.HeadersIncludeExcludeList.IsKeyOnList(key, IEList.Favorite)} /> {key}: </HeaderName>
                        <span>{ value }</span>
                    </HeaderKeyValue>

                    { description && <HeaderDescriptionContainer>
                        { description }
                        { docs && <HeaderDocsLink href={docs.url}>
                            Find out more
                        </HeaderDocsLink> }
                    </HeaderDescriptionContainer> }
                </CollapsibleSection>
            }) }
            {
hiddenCount > 0 ? 
<CollapsibleSection withinGrid={true}><HeaderKeyValue>
<HeaderName>Plus {hiddenCount} hidden...</HeaderName>

</HeaderKeyValue></CollapsibleSection>
 : <BlankContentPlaceholder />
            }
        </HeadersGrid>;
}));