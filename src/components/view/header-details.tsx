import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { parse as parseCookie, Cookie } from 'set-cookie-parser';
import * as dateFns from 'date-fns';

import { styled, css } from '../../styles';

import { getHeaderDocs } from '../../model/http-docs';

import { CollapsibleSection } from '../common/collapsible-section';
import { ExchangeCollapsibleSummary, ExchangeCollapsibleBody } from './exchange-card';
import { DocsLink } from '../common/docs-link';
import { AccountStore } from '../../model/account/account-store';

const HeadersGrid = styled.section`
    display: grid;
    grid-template-columns: 20px fit-content(30%) 1fr;

    grid-gap: 5px 0;
    &:not(:last-child) {
        margin-bottom: 10px;
    }
`;

const MonoCss = css`
    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;
    font-family: ${p => p.theme.monoFontFamily};
`;

const HeaderKeyValue = styled(ExchangeCollapsibleSummary)`
    ${MonoCss}
`;

const HeaderName = styled.span`
    margin-right: 10px;
`;

const HeaderDescriptionContainer = styled(ExchangeCollapsibleBody)`
    line-height: 1.2;
`;

const HeaderDocsLink = styled(DocsLink)`
    display: block;
    margin-top: 10px;
`;

const EmptyState = styled.div`
    opacity: 0.5;
    font-style: italic;
`;

const HeaderDescription = inject('accountStore')(observer((p: {
    name: string,
    value: string,
    requestUrl: URL,
    accountStore?: AccountStore
}) => {
    if (p.accountStore!.isPaidUser) {
        if (p.name === 'set-cookie') {
            return <CookieHeaderDescription
                value={p.value}
                requestUrl={p.requestUrl}
            />;
        }
    }

    return <DefaultHeaderDescription name={p.name} />;
}));

const DescriptionText = styled.div`
    p:not(:last-child) {
        margin-bottom: 10px;
    }

    code {
        ${MonoCss}
    }
`;

export const CookieHeaderDescription = (p: { value: string, requestUrl: URL }) => {
    const cookies = parseCookie(p.value);

    // The effective path at which cookies will be set by default.
    const requestPath = p.requestUrl.pathname.replace(/\/[^\/]*$/, '') || '/';

    return <>{
        // In 99% of cases there is only one cookie here, but we can play it safe.
        cookies.map((
            cookie: Cookie & { sameSite?: 'Strict' | 'Lax' }
        ) => <DescriptionText key={cookie.name}>
            <p>
                Set cookie '<code>{cookie.name}</code>' to '<code>{cookie.value}</code>'
            </p>

            <p>
                This cookie will be sent in future
                { cookie.secure ? ' secure ' : ' secure and insecure ' }
                requests to{' '}
                { cookie.domain ? <>
                    {cookie.domain.replace(/^\./, '')} and subdomains
                </> : <>
                    {p.requestUrl.hostname}, but not its subdomains
                </> }

                { cookie.path === '/' || requestPath === '/' ? <>
                    .
                </> : cookie.path !== undefined ? <>
                    , for paths within '{cookie.path}'.
                </> : <>
                    , for paths within '{requestPath}'.
                </> }
            </p>
            <p>
                The cookie is {
                    cookie.httpOnly ?
                        'not accessible from client-side scripts' :
                        'accessible from client-side scripts running on matching pages'
                }
                { cookie.sameSite === undefined ? <>
                    . Matching requests triggered from other origins will {
                        cookie.httpOnly ? 'however' : 'also'
                    } include this cookie.
                </> : cookie.sameSite.toLowerCase() === 'strict' ? <>
                    , { cookie.httpOnly ? 'and' : 'but' } matching requests triggered
                    from other origins will not include this cookie.
                </> : <>{ /* sameSite === 'lax' */ }
                    . Matching requests triggered from other origins will include this
                    cookie, but only if they are top-level navigations using safe HTTP methods.
                </> }
            </p>

            <p>
                The cookie {
                    cookie.maxAge ? <>
                        { getExpiryExplanation(dateFns.addSeconds(new Date(), cookie.maxAge)) }
                        { cookie.expires && ` ('max-age' overrides 'expires')` }
                    </> :
                    cookie.expires ?
                        getExpiryExplanation(cookie.expires)
                    : 'expires at the end of the current session'
                }.
            </p>
            <p>
                <HeaderDocsLink href={getHeaderDocs('set-cookie')!.url}>
                    Find out more
                </HeaderDocsLink>
            </p>
        </DescriptionText>)
    }</>
};

function getExpiryExplanation(date: Date) {
    const isFuture = dateFns.isFuture(date);
    const exactTime = dateFns.format(date, 'YYYY-MM-DD [at] HH:mm:ss');
    const relativeTime = dateFns.distanceInWordsToNow(date);

    if (isFuture) {
        return <>
            will expire <span title={exactTime}>in {relativeTime}</span>
        </>
    } else {
        return <>
            expired <span title={exactTime}>{relativeTime} ago</span>
        </>
    }
}

const DefaultHeaderDescription = (p: { name: string }) => {
    const docs = getHeaderDocs(p.name);

    if (!docs) return null;

    return <>
        { docs.summary }
        <HeaderDocsLink href={docs.url}>
            Find out more
        </HeaderDocsLink>
    </>;
};

export const HeaderDetails = (props: {
    headers: { [key: string]: string | string[] },
    requestUrl: URL
}) => {
    const headerNames = Object.keys(props.headers).sort();

    return headerNames.length === 0 ?
        <EmptyState>(None)</EmptyState>
    :
        <HeadersGrid>
            { _.flatMap(headerNames, (name) => {
                const headerValue = props.headers[name];
                if (typeof headerValue === 'string') {
                    return {
                        name,
                        value: headerValue,
                        key: name
                    };
                } else {
                    return headerValue.map((value, i) => ({
                        name,
                        value,
                        key: name + i
                    }));
                }
            }).map(({ name, value, key }) => {
                const description = <HeaderDescription name={name} value={value} requestUrl={props.requestUrl} />;

                return <CollapsibleSection withinGrid={true} key={key}>
                        <HeaderKeyValue>
                            <HeaderName>{ name }: </HeaderName>
                            <span>{ value }</span>
                        </HeaderKeyValue>

                        { description && <HeaderDescriptionContainer>
                            { description }
                        </HeaderDescriptionContainer> }
                </CollapsibleSection>
            }) }
        </HeadersGrid>;
};