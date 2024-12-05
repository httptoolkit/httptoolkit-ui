import * as React from 'react';

import {
    isFuture,
    addSeconds,
    format as formatDate,
    distanceInWordsToNow
} from 'date-fns';

import { SetCookie, parseSetCookieHeader } from '../../../model/http/cookies'
import { Content } from '../../common/text-content';

function getExpiryExplanation(date: Date) {
    const exactTime = formatDate(date, 'YYYY-MM-DD [at] HH:mm:ss');
    const relativeTime = distanceInWordsToNow(date);

    if (isFuture(date)) {
        return <>
            will expire <span title={exactTime}>in {relativeTime}</span>
        </>
    } else {
        return <>
            expired <span title={exactTime}>{relativeTime} ago</span>
        </>
    }
}

export const CookieHeaderDescription = (p: { value: string, requestUrl: URL }) => {
    const cookies = parseSetCookieHeader(p.value);

    // The effective path at which cookies will be set by default.
    const requestPath = p.requestUrl.pathname.replace(/\/[^\/]*$/, '') || '/';

    return <>{
        // In 99% of cases there is only one cookie here, but we can play it safe.
        cookies.map((cookie: SetCookie) => {
            if (cookie.samesite?.toLowerCase() === 'none' && !cookie.secure) {
                return <Content key={cookie.name}>
                    <p>
                        This attempts to set cookie '<code>{cookie.name}</code>' to
                        '<code>{cookie.value}</code>'
                    </p>
                    <p>
                        <strong>This will fail so this cookie will not be set</strong>,
                        because <code>SameSite=None</code> can only be used for cookies
                        with the <code>Secure</code> flag.
                    </p>
                </Content>;
            }

            return <Content key={cookie.name}>
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
                        cookie.httponly ?
                            'not accessible from client-side scripts' :
                            'accessible from client-side scripts running on matching pages'
                    }
                    { (cookie.samesite === undefined || cookie.samesite.toLowerCase() === 'lax')
                        // Lax is default for modern browsers (e.g. Chrome 80+)
                        ? <>
                            . Matching requests triggered from other origins will {
                                cookie.httponly ? 'however' : 'also'
                            } include this cookie, if they are top-level navigations (not subresources).
                        </>
                    : cookie.samesite.toLowerCase() === 'strict' && cookie.httponly
                        ? <>
                            , or sent in requests triggered from other origins.
                        </>
                    : cookie.samesite.toLowerCase() === 'strict' && !cookie.httponly
                        ? <>
                            , but will not be sent in requests triggered from other origins.
                        </>
                    : cookie.samesite.toLowerCase() === 'none' && cookie.secure
                        ? <>
                            . Matching requests triggered from other origins will {
                                cookie.httponly ? 'however' : 'also'
                            } include this cookie.
                        </>
                    : <>
                        . This cookie uses an unrecognized SameSite property, which may cause issues.
                    </>
                    }
                </p>

                <p>
                    The cookie {
                        cookie['max-age'] ? <>
                            { getExpiryExplanation(addSeconds(new Date(), parseInt(cookie['max-age'], 10))) }
                            { cookie.expires && ` ('max-age' overrides 'expires')` }
                        </> :
                        cookie.expires ?
                            getExpiryExplanation(new Date(cookie.expires))
                        : 'expires at the end of the current session'
                    }.
                </p>
            </Content>;
        })
    }</>
};