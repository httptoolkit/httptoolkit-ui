import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../../styles';
import { HttpVersion, RawHeaders } from '../../../types';
import { Icon } from '../../../icons';
import { copyToClipboard } from '../../../util/ui';

import { getHeaderDocs } from '../../../model/http/http-docs';
import { AccountStore } from '../../../model/account/account-store';
import { UiStore } from '../../../model/ui/ui-store';
import { ContextMenuItem } from '../../../model/ui/context-menu';

import { CollapsibleSection } from '../../common/collapsible-section';
import { DocsLink } from '../../common/docs-link';
import { BlankContentPlaceholder } from '../../common/text-content';
import {
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../../common/collapsible-section';
import { PillButton } from '../../common/pill';

import { CookieHeaderDescription } from './set-cookie-header-description';
import { UserAgentHeaderDescription } from './user-agent-header-description';

const HeadersGrid = styled.section`
    display: grid;
    grid-template-columns: 20px fit-content(30%) 1fr;

    grid-gap: 5px 0;
    &:not(:last-child) {
        margin-bottom: 10px;
    }
`;

const HeaderKeyValueContainer = styled(CollapsibleSectionSummary)`
    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;
    font-family: ${p => p.theme.monoFontFamily};
    line-height: 1.1;
`;

const LONG_HEADER_LIMIT = 500;

const HEADER_CONTEXT_MENU = [
    { type: 'option', label: 'Copy header value', callback: ({ value }) => copyToClipboard(value) },
    { type: 'option', label: 'Copy header name', callback: ({ key }) => copyToClipboard(key) },
    { type: 'option', label: 'Copy header as "name: value"', callback: ({ key, value }) => copyToClipboard(`${key}: ${value}`) },
] satisfies Array<ContextMenuItem<{ key: string, value: string }>>;

const HeaderKeyValue = inject('uiStore')((p: {
    headerKey: string,
    headerValue: string,

    // All injected by CollapsibleSection itself:
    children?: React.ReactNode,
    open?: boolean,
    withinGrid?: boolean,

    uiStore?: UiStore
}) => {
    const isLongValue = p.headerValue.length > LONG_HEADER_LIMIT;
    const [isExpanded, setExpanded] = React.useState(false);

    const expand = React.useCallback(() => setExpanded(true), [setExpanded]);
    const collapse = React.useCallback(() => setExpanded(false), [setExpanded]);

    const onContextMenu = React.useCallback((e: React.MouseEvent) => {
        if (window.getSelection()?.type === 'Range') return; // If you right click selected text, we delegate to defaults

        p.uiStore!.handleContextMenuEvent(e, HEADER_CONTEXT_MENU, {
            key: p.headerKey,
            value: p.headerValue
        });
    }, [p.uiStore, p.headerKey, p.headerValue]);

    return <HeaderKeyValueContainer
        open={p.open}
        withinGrid={p.withinGrid}
        onContextMenu={onContextMenu}
    >
        { p.children }
        <HeaderName>{ p.headerKey }: </HeaderName>
        { !isLongValue
            ? <span>{ p.headerValue }</span>
        : isExpanded
            ? <span>
                { p.headerValue }
                <LongHeaderButton
                    title='Collapse this large header value'
                    onClick={collapse}
                >
                    <Icon icon={['fas', 'minus']} />
                </LongHeaderButton>
            </span>
        : // Collapsed long header:
            <LongHeaderValue>
                { p.headerValue.slice(0, LONG_HEADER_LIMIT - 10) }
                <LongHeaderButton
                    title='Expand to show the full contents of this large header value'
                    onClick={expand}
                >...</LongHeaderButton>
            </LongHeaderValue>
        }
    </HeaderKeyValueContainer>;
});

const LongHeaderValue = styled.span`
    position: relative;

    :after {
        content: '';
        background-image: linear-gradient(to bottom, transparent, transparent 60%, ${p => p.theme.mainBackground});
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }
`;

const LongHeaderButton = styled(PillButton)`
    position: relative;
    z-index: 1;

    vertical-align: middle;
    padding: 2px 4px;
    font-size: 10px;
    margin-left: 4px;
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

export const HeaderDetails = inject('accountStore')(observer((props: {
    httpVersion: HttpVersion,
    headers: RawHeaders,
    requestUrl: URL,
    accountStore?: AccountStore
}) => {
    const sortedHeaders = _.sortBy(props.headers, ([key]) => key.toLowerCase());

    if (sortedHeaders.length === 0) {
        return <BlankContentPlaceholder>(None)</BlankContentPlaceholder>
    }

    // Filter out HTTP/2 pseudo-headers - they're not relevant, as all details (URL,
    // method, status, etc) are shown elsewhere.
    const normalHeaders = sortedHeaders.filter(([key]) => !key.startsWith(':'));

    return <HeadersGrid>
        { _.flatMap(normalHeaders, ([key, value], i) => {
            const docs = getHeaderDocs(key);
            const description = getHeaderDescription(
                key,
                value,
                props.requestUrl,
                props.accountStore!.isPaidUser
            )

            return <CollapsibleSection
                contentName={`${key} header details`}
                withinGrid={true}
                key={`${key}-${i}`}
            >
                <HeaderKeyValue headerKey={key} headerValue={value} />

                { description && <HeaderDescriptionContainer>
                    { description }
                    { docs && <HeaderDocsLink href={docs.url}>
                        Find out more
                    </HeaderDocsLink> }
                </HeaderDescriptionContainer> }
            </CollapsibleSection>;
        }) }
    </HeadersGrid>;
}));

export const HeaderHeadingContainer = styled.div<{ open?: boolean }>`
    display: flex;
    align-items: baseline;
    justify-content: flex-start;
    ${p => p.open !== true && `
        margin-bottom: -10px;
    `}
`;