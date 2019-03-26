import * as _ from 'lodash';
import * as dedent from "dedent";
import {
    parse as parseDate,
    differenceInSeconds,
    addSeconds
} from 'date-fns';

import { HttpExchange } from "./exchange";
import { lastHeader, asHeaderArray, joinAnd } from "../util";
import { ExchangeMessage } from '../types';

// https://tools.ietf.org/html/draft-ietf-httpbis-semantics-04#section-7.2.3
const CACHEABLE_METHODS = ['GET', 'HEAD', 'POST'];

// https://tools.ietf.org/html/draft-ietf-httpbis-semantics-01#section-9.1
const CACHEABLE_STATUSES = [
    200,
    203,
    204,
    206,
    300,
    301,
    404,
    405,
    410,
    414,
    501
];

// The cacheable behaviour of these isn't explicitly defined, but the semantics clearly
// indicate permanence, and Chrome at least caches them forever if no lifetime is set.
// See https://chromium.googlesource.com/chromium/src/+/74.0.3729.30/net/http/http_response_headers.cc#1087
const PERMANENTLY_CACHEABLE_STATUSES = [
    300,
    301,
    308,
    410
];

// The set of CORS methods/headers which do never require preflight
// requests (and so don't block cache matches)
const CORS_SIMPLE_METHODS = ['GET', 'HEAD', 'POST'];
const CORS_SIMPLE_HEADERS = [
    'Cache-Control',
    'Content-Language',
    'Content-Type',
    'Expires',
    'Last-Modified',
    'Pragma'
];

function formatHeader(headerName: string): string {
    // Upper case the first letter of each word (including hyphenated parts)
    return headerName.toLowerCase().replace(/(\b\w)/g, v => v.toUpperCase())
}

interface Explanation {
    summary: string,
    explanation: string,
    type?: 'suggestion' | 'warning',
};

function parseCCDirectives(message: ExchangeMessage): {
    'max-age'?: number;
    's-maxage'?: number;
    [name: string]: true | number | undefined;
} {
    return asHeaderArray(message.headers['cache-control'])
        .reduce<{ [name: string]: true | number }>((result, directive) => {
            const [ name, value ] = directive.split('=');
            result[name.trim()] = value !== undefined ? parseInt(value) : true;
            return result;
        }, {});
}

export function explainCacheability(exchange: HttpExchange): (
    Explanation & { cacheable: boolean }
) | undefined {
    const { request, response } = exchange;

    if (typeof response !== 'object') return;

    const isCacheableMethod = CACHEABLE_METHODS.includes(request.method);

    if (!isCacheableMethod) {
        if (request.method === 'OPTIONS' && request.headers['origin']) {
            // This is a CORS preflight request - it's not really cacheable, but the CORS
            // headers specifically (probably the only interesting bit) are, via their
            // own separate funky mechanism.
            const maxAgeHeader = lastHeader(response.headers['access-control-max-age']);
            const maxAge = maxAgeHeader ? parseInt(maxAgeHeader, 10) : undefined;

            if (maxAge !== undefined && maxAge >= 1) {
                return {
                    cacheable: true,
                    summary: 'Cacheable',
                    explanation: dedent`
                        OPTIONS preflight requests are not normally cacheable, and don't observe
                        standard Cache-Control mechanisms, but the CORS result itself will be
                        cached if a Access-Control-Max-Age header is provided, as here.

                        This only affects CORS behaviour for cross-origin requests, and should be
                        ignored (so not cached at all) by all other clients and proxies.
                    `
                };
            }

            if (maxAge !== undefined && maxAge <= 0) {
                return {
                    cacheable: false,
                    summary: 'Not cacheable',
                    explanation: dedent`
                        OPTIONS preflight requests don't observe standard Cache-Control
                        mechanisms, but the CORS result itself can be cached if a
                        Access-Control-Max-Age header is provided.

                        In this case that header is set to ${maxAgeHeader}, explicitly
                        requesting that this result should not be cached, and that clients
                        should not reuse this CORS response in future.
                    `
                };
            }

            return {
                cacheable: true,
                summary: 'Very briefly cacheable',
                explanation: dedent`
                    OPTIONS preflight requests are not cacheable, unless an Access-Control-Max-Age
                    header is provided. Many clients will very briefly cache the CORS response
                    though, for example Chrome will cache this for 5 seconds.
                `
            };
        } else {
            return {
                cacheable: false,
                summary: 'Not cacheable',
                explanation: `${request.method} requests are never cacheable.`
            };
        }
    }

    const responseCCDirectives = parseCCDirectives(response);

    const hasRevalidationOptions = response.headers['etag'] || response.headers['last-modified'];
    const revalidationSuggestion = !hasRevalidationOptions && !responseCCDirectives['immutable'] ?
        dedent`
            This response doesn't however include any validation headers. That means that once
            it expires, the content must be requested again from scratch. If a Last-Modified
            or ETag header were included then these could be used to make conditional HTTP requests
            and revalidate cached content without re-requesting it, saving time and bandwidth.
        ` : '';

    if (!!responseCCDirectives['no-store']) {
        return {
            cacheable: false,
            summary: 'Not cacheable',
            explanation: dedent`
                This response includes a \`no-store\` directive in its Cache-Control
                header. This explicitly tells all caches that this response should
                never be cached. It should never be persistently stored, should
                be removed from any volatile/temporary storage as soon as possible,
                and should requested fresh from the network in future.
            `
        }
    }

    if (asHeaderArray(response.headers['pragma']).includes('no-store')) {
        return {
            cacheable: false,
            summary: 'Not cacheable',
            type: 'suggestion',
            explanation: dedent`
                This response includes a \`no-store\` directive in its Pragma
                header. This explicitly tells all caches that this response should
                never be cached. It should never be persistently stored, should
                be removed from any volatile/temporary storage as soon as possible,
                and should requested fresh from the network in future.

                This Pragma header is commonly supported, but officially deprecated.
                It's typically better to use \`Cache-Control: no-store\` instead.
            `
        }
    }

    if (asHeaderArray(response.headers['vary']).includes('*')) {
        return {
            cacheable: false,
            summary: 'Not cacheable',
            explanation: dedent`
                This response includes a \`*\` value in its Vary header. This tells caches
                that the response content may vary unpredictably, possibly including factors
                outside the request's content (e.g. the client's network address),
                and so must never be cached.
            `
        };
    }

    if (request.method === 'POST') {
        // POSTS aren't really cacheable like anything else - they have their own unique rules
        const postExplanation = dedent`
            POST responses are not typically cacheable, but can be used in some
            specific circumstances to prepopulate GET & HEAD caches for the same URI.
            This is allowed by the spec, but not supported by many clients.

            A POST response may be cached and used by for future GET/HEAD requests only if:

            * Explicit freshness information is included (e.g. a \`max-age\` Cache-Control
                directive), and
            * a Content-Location header is included, set to the same
                URI as this request
        `;

        const contentLocationUrl = response.headers['content-location'] ?
            new URL(lastHeader(response.headers['content-location']!), request.url) : undefined;

        const hasFreshnessInfo =
            !!responseCCDirectives['max-age'] ||
            response.headers['expires'] !== undefined;
        const contentLocationIsCurrentUri = contentLocationUrl && (
            contentLocationUrl.toString().split('#')[0] === request.parsedUrl.toString().split('#')[0]
        );

        if (hasFreshnessInfo && contentLocationIsCurrentUri) {
            return {
                cacheable: true,
                summary: 'May be cacheable for future GET/HEAD requests',
                type: revalidationSuggestion ? 'suggestion' : undefined,
                explanation: [
                    postExplanation,
                    'This response fulfills those conditions, so may be cacheable by some clients.',
                    revalidationSuggestion
                ].join('\n\n')
            };
        } else {
            return {
                cacheable: false,
                summary: 'Not cacheable',
                explanation: postExplanation + '\n\n' +
                    'This response does not fulfill those conditions, so is not cacheable by anybody.'
            };
        }
    }

    if (responseCCDirectives['max-age'] !== undefined) {
        let warning: string | undefined;

        const responseDateHeader = response.headers['date'] ?
            parseDate(lastHeader(response.headers['date'])!)
            : undefined;
        const requestReceivedDate = parseDate(exchange.timingEvents.startTime);

        if (!responseDateHeader) {
            warning = dedent`
                This response does not include a Date header however. That value
                would be used in combination with the \`max-age\` value to calculate
                the exact time to expire this content. Clients may infer and
                record their own response time, but it's typically preferable to
                explicitly specify it in the response.
            `;
        } else if (Math.abs(differenceInSeconds(responseDateHeader, requestReceivedDate)) > 60) {
            warning = dedent`
                The Date header included here however appears to be incorrect (compared to
                your local clock). This value is used in combination with the \`max-age\`
                value to calculate the exact time to expire the content. This probably means
                either your machine or the server's clock is incorrect, and might cause
                unpredictable cache expiry issues.
            `;
        } else if (response.headers['expires'] && Math.abs(differenceInSeconds(
            parseDate(lastHeader(response.headers['expires']!)),
            addSeconds(responseDateHeader, responseCCDirectives['max-age'])
        )) > 60) {
            warning = dedent`
                This response also includes an Expires header, which appears to disagree
                with the expiry time calculated from the \`max-age\` directive. The Cache-Control
                headers take precedence, so this will only be used by clients that don't
                support that, but this may cause unpredictable behaviour. It's typically
                better than ensure these values agree on a single expiry time.
            `;
        }

        const shouldSuggestImmutable = !responseCCDirectives['immutable'] &&
            responseCCDirectives['max-age'] >= 31536000; // 1 year

        return {
            cacheable: true,
            summary: 'Cacheable',
            type:
                warning ? 'warning' :
                (revalidationSuggestion || shouldSuggestImmutable) ? 'suggestion' :
                undefined,
            explanation: dedent`
                This response is cacheable because it specifies an explicit expiry time,
                using a \`max-age\` directive in its Cache-Control header.
                ${
                    warning ? '\n' + warning :
                    revalidationSuggestion ? '\n' + revalidationSuggestion :
                    shouldSuggestImmutable ? '\n' + dedent`
                        This expiry time is more than a year away, suggesting the content
                        effectively never changes. This could be made more effective using the
                        \`immutable\` Cache-Control directive, which avoids revalidation
                        requests for this content in more cases such as explicit page refreshes,
                        saving validation time.
                    ` :
                    ''
                }
            `
        };
    }

    if (lastHeader(response.headers['expires']) !== undefined) {
        // Expires set, but not max-age (checked above).
        return {
            cacheable: true,
            summary: 'Cacheable',
            type: 'suggestion',
            explanation: dedent`
                This response is cacheable because it specifies an explicit expiry time,
                using an Expires header.

                The Expires header is commonly supported, but officially deprecated.
                It's typically better to use \`Cache-Control: max-age=<seconds>\` instead.
            `
        };
    }

    const isDefaultCacheableStatus = CACHEABLE_STATUSES.includes(response.statusCode);

    if (isDefaultCacheableStatus || responseCCDirectives['public']) {
        // We're cacheable, but with no expiry details at all.

        if (PERMANENTLY_CACHEABLE_STATUSES.includes(response.statusCode)) {
            return {
                cacheable: true,
                summary: 'Cacheable',
                explanation: dedent`
                    ${response.statusCode} responses are cacheable by default. The lifetime of the
                    cached response isn't strictly specified, but since this status code is
                    intended to indicate a permanent change the overwhelming majority of clients
                    will cache it forever.
                `
            };
        }

        // Temporarily cacheable, but for no specified time. Not a great idea.

        const cacheableReason = isDefaultCacheableStatus ?
            `${response.statusCode} responses are cacheable by default` :
            `This response includes a \`public\` Cache-Control directive, explicitly marking it cacheable`;

        if (!hasRevalidationOptions) {
            // We're cacheable, but with no clear expiry *and* no way to revalidate.
            return {
                cacheable: false,
                summary: 'Typically not cacheable',
                type: 'warning',
                explanation: dedent`
                    ${cacheableReason}. However most caches will not store a response
                    like this, which has no explicit expiry time and no way to revalidate
                    the content in future.

                    It's typically better to be explicit about if and how responses should
                    be cached, rather than depending on the unpredictable behaviour this
                    can cause.

                    This request would be reliably cached if an explicit expiry was set (e.g.
                    with a \`max-age\` Cache-Control directive). Alternatively this would be
                    reliably excluded from caching if a \`no-store\` Cache-Control directive
                    was present.
                `
            }
        } else if (responseCCDirectives['no-cache']) {
            // We're cacheable and revalidateable, with forced revalidation every time, so 0 expiry
            return {
                cacheable: true,
                summary: 'Cacheable',
                explanation: dedent`
                    ${cacheableReason}.

                    The response does not include any explicit expiry information,
                    but does include a \`no-cache\` directive, meaning the cached content will
                    be revalidated with the origin server on every request, making
                    expiry irrelevant.
                `
            };
        } else {
            // We're cacheable and revalidateable, but there's no clear expiry

            return {
                cacheable: true,
                summary: 'Probably cacheable',
                type: 'warning',
                explanation: dedent`
                    ${cacheableReason}. However this response does not explicitly
                    specify when it expires (e.g. with a \`max-age\` Cache-Control
                    directive), so its expiry behaviour is not well defined. Caches
                    may use a heuristic to decide when this response is no longer
                    considered fresh, and some clients may refuse to cache the response
                    entirely.

                    It's typically better to be explicit about how responses should be cached
                    and expired, rather than depending on this unpredictable behaviour.

                    If an explicit expiry time was set (e.g. using a \`max-age\` Cache-Control
                    directive), this would take precedence over any heuristics, and provide
                    reliable cache expiry. Alternatively this content would be reliably
                    excluded from caching if a \`no-store\` Cache-Control directive was present.
                `
            };
        }
    }

    if (responseCCDirectives['s-maxage'] !== undefined) {
        // We're not locally cacheable at all, but we are proxy cacheable???!!! Super funky
        return {
            cacheable: true,
            summary: 'Not cacheable by private (HTTP client) caches',
            explanation: dedent`
                This response is cacheable because it specifies an explicit expiry time,
                using an \`s-maxage\` Cache-Control directive. This only applies to shared
                caches (e.g. proxies and CDNs), and this response would otherwise not be
                cacheable, so it won't be cached by any HTTP user agents (e.g. browsers).
            `
        };
    }

    return {
        cacheable: false,
        summary: 'Not cacheable',
        explanation: dedent`
            ${response.statusCode} responses are not cacheable by default.
            This could become cacheable if explicit caching headers were added,
            such as a \`max-age\` Cache-Control directive.
        `
    };
}

const ALL_CACHES = 'May be cached in client *private caches* and proxy or CDN *shared caches*.';
const PRIVATE_ONLY = 'May only be cached in client *private caches*, not by proxies or CDNs.'
const SHARED_ONLY = 'May only be cached in proxy or CDN *shared caches*, not in private client caches';

/**
 * Explains the details of which types of cache can be store this response,
 * and why. This assumes that explainCacheability has returned cacheability: true,
 * and doesn't fully repeat the checks included there.
 */
export function explainValidCacheTypes(exchange: HttpExchange): Explanation | undefined {
    const { request, response } = exchange;
    if (typeof response !== 'object') return;

    if (request.method === 'OPTIONS' && request.headers['origin']) {
        return {
            summary: PRIVATE_ONLY,
            explanation: dedent`
                OPTIONS responses are not cached through the normal HTTP response caching mechanisms.
                Only the CORS metadata for the resource is cached, and only by HTTP clients that
                implement CORS checks, such as browsers, not by intermediate caches.
            `
        };
    }

    const responseCCDirectives = parseCCDirectives(response);

    if (responseCCDirectives['private'] !== undefined) {
        return {
            summary: PRIVATE_ONLY,
            explanation: dedent`
                This response may only be cached by private caches, such as your browser cache,
                because it includes an explicit \`private\` Cache-Control directive.
            `
        };
    }

    if (
        request.headers['authorization'] !== undefined && !(
            responseCCDirectives['s-maxage'] !== undefined ||
            responseCCDirectives['must-revalidate'] !== undefined ||
            responseCCDirectives['public'] !== undefined
        )
    ) {
        return {
            summary: PRIVATE_ONLY,
            explanation: dedent`
                This response may only be cached by private caches, such as your browser cache,
                because it includes an Authorization header, and doesn't include the explicit
                directives that would allow it to be stored by shared caches.

                Shared caches would be allowed to store this response if it contained an
                \`s-maxage\`, \`must-revalidate\` or \`public\` Cache-Control directive.
            `
        };
    }

    if (responseCCDirectives['s-maxage'] !== undefined && !(
            responseCCDirectives['max-age'] !== undefined ||
            response.headers['expires'] !== undefined ||
            responseCCDirectives['public'] !== undefined ||
            CACHEABLE_STATUSES.includes(response.statusCode)
        )
    ) {
        return {
            summary: SHARED_ONLY,
            explanation: dedent`
                This response may only be cached by shared caches, such as proxies & CDNs,
                not by private caches, because it includes an \`s-maxage\` Cache-Control
                directive, but is otherwise not cacheable by default, and does not include
                any other explicit caching directives.
            `
        };
    }

    return {
        summary: ALL_CACHES,
        explanation: dedent`
            This response may be cached by both private & shared caches, because it is
            cacheable and does not include either a \`private\` Cache-Control
            directive or an Authorization header.
        `
    };
}

/**
 * Explains how this response will be matched against future requests and why.
 * This assumes that explainCacheability has returned cacheability: true,
 * so doesn't fully repeat the checks included there.
 */
export function explainCacheMatching(exchange: HttpExchange): Explanation | undefined {
    const { request, response } = exchange;
    if (typeof response !== 'object') return;

    if (request.method === 'OPTIONS' && request.headers['origin']) {
        const allowedMethods = _.union(
            CORS_SIMPLE_METHODS,
            asHeaderArray(response.headers['access-control-allow-methods'])
                .map(m => m.toUpperCase()),
        );
        const allowedHeaders = _.union(
            CORS_SIMPLE_HEADERS,
            asHeaderArray(response.headers['access-control-allow-headers'])
                .map(formatHeader)
        );
        const allowsCredentials = response.headers['Access-Control-Allow-Credentials'] === 'true';

        return {
            summary: 'Will match corresponding future CORS requests for this URL',
            explanation: dedent`
                The CORS configuration returned here may be used to avoid a preflight
                request for future CORS requests, when:

                * The CORS request would be sent to the same URL
                * The origin is \`${request.headers['origin']}\`
                ${!allowsCredentials ? '* No credentials are being sent' : ''
                }* The request method would be ${joinAnd(allowedMethods, ', ', ' or ')}
                * There are no extra request headers other than ${joinAnd(allowedHeaders)}
            `
        };
    }

    const varyHeaders = asHeaderArray(response.headers['vary']).map(formatHeader);

    const hasVaryHeaders = varyHeaders.length > 0;

    // Don't need to handle Vary: *, as that would've excluded cacheability entirely.

    const varySummary = hasVaryHeaders ? dedent`
        , with the same ${joinAnd(varyHeaders)} header${varyHeaders.length > 1 ? 's' : ''}
    ` : '';

    const varyExplanation = hasVaryHeaders ? dedent`
        , as long as those requests have ${joinAnd(varyHeaders.map(headerName => {
            const realHeaderValue = request.headers[headerName.toLowerCase()];

            return realHeaderValue === undefined ?
                `no ${headerName} header` :
                `a ${headerName} header set to \`${realHeaderValue}\``
        }))}.
    ` : dedent`
        , regardless of header values or other factors.

        If this response is only valid for certain header configurations (e.g.
        Accept-Encoding or Accept-Language headers), it should include a Vary header.
    `;

    if (request.method === 'POST') {
        return {
            summary: `Will match future GET & HEAD requests to this URL${varySummary}`,
            explanation: dedent`
                The response content & headers returned here may be used for future safe requests
                for the resource updated by this POST${varyExplanation}
            `
        };
    }

    return {
        summary: `Will match future GET & HEAD requests to this URL${varySummary}`,
        explanation: dedent`
            The response content & headers returned here may be used for future safe requests
            for the same resource${varyExplanation}
        `
    };
}