import * as _ from 'lodash';
import * as dedent from "dedent";
import {
    parse as parseDate,
    differenceInSeconds,
    addSeconds,
    distanceInWordsStrict
} from 'date-fns';

import { ExchangeMessage, HttpExchangeView } from '../../types';
import { getHeaderValue, asHeaderArray } from './headers';
import { joinAnd } from '../../util/text';
import { escapeForMarkdownEmbedding } from '../ui/markdown';

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
    return headerName.toLowerCase().replace(/(\b\w)/g, v => v.toUpperCase());
}

function escapeAndFormatHeader(headerName: string): string {
    return `<code>${escapeForMarkdownEmbedding(
        formatHeader(headerName)
    )}</code>`;
}

const THE_DAWN_OF_TIME = parseDate(0);
function formatDuration(seconds: number): string {
    return distanceInWordsStrict(
        THE_DAWN_OF_TIME,
        parseDate(seconds * 1000)
    )
}

interface Explanation {
    summary: string,
    explanation: string,
    type?: 'suggestion' | 'warning',
};

function parseCCDirectives(message: ExchangeMessage): {
    'max-age'?: number;
    's-maxage'?: number;
    'stale-while-revalidate'?: number;
    'stale-if-error'?: number;
    [name: string]: true | number | undefined;
} {
    return asHeaderArray(message.headers['cache-control'])
        .reduce<{ [name: string]: true | number }>((result, directive) => {
            const [ name, value ] = directive.split('=');
            result[name.trim()] = value !== undefined ? parseInt(value) : true;
            return result;
        }, {});
}

export function explainCacheability(exchange: HttpExchangeView): (
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
            const maxAgeHeader = getHeaderValue(response.headers, 'access-control-max-age');
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

                        In this case that header is set to ${escapeForMarkdownEmbedding(
                            maxAgeHeader!
                        )}, explicitly requesting that this result should not be cached,
                        and that clients should not reuse this CORS response in future.
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
                explanation: `${escapeForMarkdownEmbedding(
                    request.method
                )} requests are never cacheable.`
            };
        }
    }

    const responseCCDirectives = parseCCDirectives(response);

    const hasRevalidationOptions = response.headers['etag'] || response.headers['last-modified'];
    const revalidationSuggestion =
        !hasRevalidationOptions &&
        // Revalidation makes no sense without a body
        response.body.encodedByteLength &&
        !responseCCDirectives['immutable'] ?
        dedent`
            :suggestion: This response doesn't however include any validation headers. That
            means that once it expires, the content must be requested again from scratch. If
            a Last-Modified or ETag header were included then these could be used to make
            conditional HTTP requests and revalidate cached content without re-requesting
            it, saving time and bandwidth.
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
                and should be requested fresh from the network in future.
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
                and should be requested fresh from the network in future.

                :suggestion: This Pragma header is commonly supported, but officially
                deprecated. It's typically better to use \`Cache-Control: no-store\` instead.
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
            new URL(getHeaderValue(response.headers, 'content-location')!, request.url) : undefined;

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
            parseDate(getHeaderValue(response.headers, 'date')!)
            : undefined;

        if (!responseDateHeader) {
            warning = dedent`
                :warning: However, this response does not include a Date header. That value
                would be used in combination with the \`max-age\` value to calculate
                the exact time to expire this content.

                Clients may infer their own expiry start time, potentially using the time they
                received this response, but it's strongly recommended to explicitly specify
                one in the response instead, to ensure this content expires reliably and
                predictably.
            `;
        } else if (response.headers['expires'] && Math.abs(differenceInSeconds(
            parseDate(getHeaderValue(response.headers, 'expires')!),
            addSeconds(responseDateHeader, responseCCDirectives['max-age'])
        )) > 60) {
            warning = dedent`
                :warning: This response also includes an Expires header, which appears to disagree
                with the expiry time calculated from the \`max-age\` directive. The Cache-Control
                headers take precedence, so this will only be used by clients that don't
                support that, but this could cause unpredictable behaviour. It's typically
                better to ensure these values agree on a single expiry time.
            `;
        }

        return {
            cacheable: true,
            summary: 'Cacheable',
            type:
                warning ? 'warning' :
                revalidationSuggestion ? 'suggestion' :
                undefined,
            explanation: dedent`
                This response is cacheable because it specifies an explicit expiry time,
                using a \`max-age\` directive in its Cache-Control header.
                ${
                    warning ? '\n' + warning :
                    revalidationSuggestion ? '\n' + revalidationSuggestion :
                    ''
                }
            `
        };
    }

    if (getHeaderValue(response.headers, 'expires') !== undefined) {
        // Expires set, but not max-age (checked above).
        return {
            cacheable: true,
            summary: 'Cacheable',
            type: 'suggestion',
            explanation: dedent`
                This response is cacheable because it specifies an explicit expiry time,
                using an Expires header.

                :suggestion: The Expires header is commonly supported, but officially deprecated.
                It's typically better to use \`Cache-Control: max-age=<seconds>\` instead,
                or in addition.
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

                    :warning: It's typically better to be explicit about if and how responses
                    should be cached, rather than depending on the unpredictable behaviour this
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

                    :warning: It's typically better to be explicit about how responses should
                    be cached and expired, rather than depending on this unpredictable behaviour.

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

const ALL_CACHES = 'May be cached in both private and shared caches';
const PRIVATE_ONLY = 'May only be cached in private caches'
const SHARED_ONLY = 'May only be cached in shared caches';

/**
 * Explains the details of which types of cache can be store this response,
 * and why. This assumes that explainCacheability has returned cacheability: true,
 * and doesn't fully repeat the checks included there.
 */
export function explainValidCacheTypes(exchange: HttpExchangeView): Explanation | undefined {
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

    if (responseCCDirectives['public'] !== undefined) {
        return {
            summary: ALL_CACHES,
            explanation: dedent`
                This response may be cached by both private HTTP client caches and shared caches
                such as CDNs and proxies, because it includes an explicit \`public\` Cache-Control
                directive.
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

                Shared caches, such as CDNs and proxies, would only be allowed to store this
                response if it contained \`s-maxage\`, \`must-revalidate\` or \`public\`
                Cache-Control directives.
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
                not by private client caches, because it includes an \`s-maxage\` Cache-Control
                directive but is otherwise not cacheable by default, and does not include
                any other explicit caching directives.
            `
        };
    }

    return {
        summary: ALL_CACHES,
        explanation: dedent`
            This response may be cached by both private client caches & shared
            CDN or proxy caches, because it is cacheable and does not include
            either a \`private\` Cache-Control directive or an Authorization header.
        `
    };
}

/**
 * Explains how this response will be matched against future requests and why.
 * This assumes that explainCacheability has returned cacheability: true,
 * so doesn't fully repeat the checks included there.
 */
export function explainCacheMatching(exchange: HttpExchangeView): Explanation | undefined {
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
                .map(escapeAndFormatHeader)
        );
        const allowsCredentials = response.headers['Access-Control-Allow-Credentials'] === 'true';

        return {
            summary: 'Will match corresponding future CORS requests for this URL',
            explanation: dedent`
                The CORS configuration returned here may be used to avoid a preflight
                request for future CORS requests, when:

                * The CORS request would be sent to the same URL
                * The origin is <code>${escapeForMarkdownEmbedding(
                    request.headers['origin'].toString()
                )}</code>
                ${!allowsCredentials ? '* No credentials are being sent\n' : ''
                }* The request method would be ${escapeForMarkdownEmbedding(
                    joinAnd(allowedMethods, ', ', ' or ')
                )}
                * There are no extra request headers other than ${joinAnd(allowedHeaders)}
            `
        };
    }

    const rawVaryHeaders = asHeaderArray(response.headers['vary']);
    const hasVaryHeaders = rawVaryHeaders.length > 0;

    // Don't need to handle Vary: *, as that would've excluded cacheability entirely.

    const varySummary = hasVaryHeaders ?
        ` that have the same ${
            joinAnd(rawVaryHeaders.map(h => `'${formatHeader(h)}'`)) // No escaping - summary (non-markdown) only
        } header${rawVaryHeaders.length > 1 ? 's' : ''}`
        : '';

    const varyExplanation = hasVaryHeaders ? dedent`
        , as long as those requests have ${joinAnd(rawVaryHeaders.map(headerName => {
            const realHeaderValue = request.headers[headerName.toLowerCase()];

            const formattedName = escapeAndFormatHeader(headerName);

            return realHeaderValue === undefined ?
                `no ${formattedName} header` :
                `a ${formattedName} header set to <code>${escapeForMarkdownEmbedding(
                    realHeaderValue.toString()
                )}</code>`
        }))}.

        ${rawVaryHeaders.length > 1 ? 'These headers are' : 'This header is'}
        required because ${rawVaryHeaders.length > 1 ? "they're" : "it's"} listed in
        the Vary header of the response.
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

/**
 * Explains when response will be matched against future requests, why,
 * and what will happen after that time passes.
 * This assumes that explainCacheability has returned cacheability: true,
 * so doesn't fully repeat the checks included there.
 */
export function explainCacheLifetime(exchange: HttpExchangeView): Explanation | undefined {
    const { request, response } = exchange;
    if (typeof response !== 'object') return;

    const responseCCDirectives = parseCCDirectives(response);

    if (request.method === 'OPTIONS') {
        const maxAgeHeader = getHeaderValue(response.headers, 'access-control-max-age');

        if (maxAgeHeader) {
            const maxAge = parseInt(maxAgeHeader!, 10);

            return {
                summary: `Expires after ${formatDuration(maxAge)}`,
                explanation: dedent`
                    This CORS response includes an Access-Control-Max-Age header explicitly
                    set to ${maxAge} seconds, which defines the valid lifetime for the
                    cached response. Once this expires it will immediately cease to be used.
                `
            };
        }

        // Don't need to deal with negative max age, as we exclude that as non-cacheable
        // in explainCacheability

        return {
            summary: `Expires unpredictably, around 5 seconds`,
            explanation: dedent`
                This CORS response does not include an Access-Control-Max-Age header, so
                does not explicitly specify when it should expire. That means the
                exact expiry is left up to the client implementation. This may be a
                small number of seconds, or it may be considered expired immediately.
            `
        };
    }

    if (responseCCDirectives['no-cache']) {
        return {
            summary: "Must be revalidated every time it's used",
            explanation: dedent`
                This response includes an explicit \`no-cache\` directive. This means that
                before the cached content can be used, the matching requests must always be
                forwarded to the origin server, and the response content must be revalidated.

                This requires a request to the origin server for every client request, but
                does still offer performance benefits compared to not caching at all,
                because conditional requests can be used to avoid redownloading the
                full response from scratch if it hasn't changed.
            `
        };
    }

    const dateHeader = getHeaderValue(response.headers, 'date');
    const expiresHeader = getHeaderValue(response.headers, 'expires');
    const maxAge = responseCCDirectives['max-age'];
    const sharedMaxAge = responseCCDirectives['s-maxage'] !== undefined ?
        responseCCDirectives['s-maxage'] : maxAge;

    const hasExplicitLifetime = maxAge !== undefined || expiresHeader !== undefined;
    const lifetime =
        maxAge !== undefined ? maxAge :
        expiresHeader !== undefined ? differenceInSeconds(
            expiresHeader,
            dateHeader
                ? parseDate(dateHeader)
                : parseDate(exchange.timingEvents.startTime ?? Date.now())
        )
        : undefined;
    const hasNegativeLifetime = lifetime !== undefined && lifetime <= 0;

    if (
        !hasExplicitLifetime &&
        PERMANENTLY_CACHEABLE_STATUSES.includes(response.statusCode)
    ) {
        return {
            summary: 'Never expires' + (sharedMaxAge !== maxAge ?
                ` from private caches, expires from shared caches after ${
                    formatDuration(sharedMaxAge!)
                }` : ''
            ),
            explanation: dedent`
                This ${response.statusCode} response is intended to describe a permanent state,
                and has no explicitly defined expiry time, so by default most clients will
                cache it forever.

                ${sharedMaxAge !== maxAge ? dedent`
                    The response does include a \`s-maxage\` directive however, set to ${
                        sharedMaxAge
                    } seconds, which overrides this for shared caches such as CDNs and
                    proxies. In that specific case, the response will be considered stale
                    after ${formatDuration(sharedMaxAge!)}. As there is no \`proxy-revalidate\`
                    directive, it may still be used whilst stale if necessary or explicitly
                    allowed by a client.

                    If the response included a specific expiry time for private caches, e.g.
                    with a \`max-age\` Cache-Control directive, that typically would limit the
                    lifetime of this response in those caches too. In general though in that
                    case it would be better to use a more accurate status code.
                ` : dedent`
                    If this response did include a specific expiry time, e.g. with a max-age
                    Cache-Control directive, that would typically override this. In general
                    though in that case it would be better to use a more accurate status code.
                `}
            `
        };
    }

    const explainSharedCacheLifetime = sharedMaxAge !== maxAge ? dedent`
        .

        This response also includes a \`s-maxage\` directive, set to ${
            formatDuration(sharedMaxAge!)
        } seconds which overrides this expiry for shared caches such as CDNs or proxies.
        This means in that case, the response will become stale in ${
            formatDuration(sharedMaxAge!)
        }
    ` : '';

    const explainLifetime =
        !hasExplicitLifetime ? dedent`
            ${sharedMaxAge === maxAge ? dedent `
                This response does not explicitly declare its expiry time. Caches
            `: dedent `
                This response only declares an explicit expiry time for shared caches, such
                as proxies or CDNs, not for private caches. Content in shared caches will
                expire after ${formatDuration(sharedMaxAge!)}, as declared by the \`s-maxage\`
                Cache-Control directive, whilst content in private caches may expire
                unpredictably.

                Private caches
            `} may
            use a heuristic to decide when this response is considered stale, typically
            some percentage of the time since the content was last modified, often using
            the Last-Modified header value${
                response.headers['last-modified'] ?
                    ` (<code>${escapeForMarkdownEmbedding(
                        response.headers['last-modified'].toString()
                    )}</code>)`
                    : ', although that is not explicitly defined in this response either'
            }
        ` :
        hasNegativeLifetime ? dedent`
            This response expires immediately because it has ${
                maxAge! <= 0 ? dedent`
                    a \`max-age\` directive set to ${maxAge} seconds
                ` :
                dateHeader ? dedent `
                    an Expires header set to ${escapeForMarkdownEmbedding(expiresHeader!.toString())}, which is
                    not after its Date header value (${escapeForMarkdownEmbedding(dateHeader)})
                `
                : dedent`
                    an Expires header set to ${escapeForMarkdownEmbedding(expiresHeader!)}, which is
                    before the response was received
                `
            }${explainSharedCacheLifetime}
        ` :
        maxAge !== undefined ? dedent`
            This response expires after ${maxAge} seconds (${formatDuration(maxAge)}),
            as specified by its \`max-age\` directive${explainSharedCacheLifetime}
        `
        : dedent`
            This response expires at ${escapeForMarkdownEmbedding(expiresHeader!)} (after ${formatDuration(lifetime!)}),
            as specified by its Expires header${explainSharedCacheLifetime}
        `;

    if (hasNegativeLifetime && responseCCDirectives['must-revalidate']) {
        return {
            summary: "Must be revalidated every time it's used" + (sharedMaxAge !== maxAge ?
                ` (or after ${formatDuration(sharedMaxAge!)} for shared caches)`
                : ''
            ),
            explanation: dedent`
                ${explainLifetime}.

                In addition, it includes a \`must-revalidate\` directive.

                Together, these mean that before the cached content can be used${
                    sharedMaxAge !== maxAge && sharedMaxAge! > 0 ?
                        ' by private caches' : ''
                } the matching requests must always be forwarded to the origin server,
                and the response content must be revalidated.

                This requires a request to the origin server for every client request, but
                does still offer performance benefits compared to not caching at all,
                because conditional requests can be used to avoid redownloading the
                full response from scratch if it hasn't changed.
            `
        };
    }

    const staleBonusBehaviourSummary = (
            responseCCDirectives['stale-while-revalidate'] !== undefined &&
            responseCCDirectives['stale-if-error'] !== undefined
        ) ?
            `can be served stale temporarily whilst revalidating or if receiving errors` :
        responseCCDirectives['stale-while-revalidate'] !== undefined ?
            `can be served stale whilst revalidating for ${
                formatDuration(responseCCDirectives['stale-while-revalidate'])
            }` :
        responseCCDirectives['stale-if-error'] !== undefined ?
            `can be served stale if errors are received for ${
                formatDuration(responseCCDirectives['stale-if-error'])
            }` :
        '';

    const revalidationSummary =
        responseCCDirectives['must-revalidate'] ?
            `, then must always be revalidated` :
        responseCCDirectives['proxy-revalidate'] && staleBonusBehaviourSummary ?
            `, then ${staleBonusBehaviourSummary} (but must be revalidated by shared caches)` :
        responseCCDirectives['proxy-revalidate'] ?
            `, then must always be revalidated by shared caches, but may be used privately` :
        staleBonusBehaviourSummary ?
            `, then ${staleBonusBehaviourSummary}`
        : '';

    const staleBonusBehaviour = (
            responseCCDirectives['stale-while-revalidate'] !== undefined &&
            responseCCDirectives['stale-if-error'] !== undefined
        ) ? dedent`
            The response includes both \`stale-while-revalidate\` and \`stale-if-error\`
            directives, set to ${
                responseCCDirectives['stale-while-revalidate']
            } seconds and ${responseCCDirectives['stale-if-error']} seconds respectively.

            \`stale-while-revalidate\` means that after the response has expired, new
            requests should trigger revalidation, but the stale content can still be served
            in the meantime, for ${
                formatDuration(responseCCDirectives['stale-while-revalidate']!)
            } extra.

            \`stale-if-error\` means that after the response has expired, new
            requests should trigger revalidation, but the stale content can still be served
            in the meantime if any errors are encountered, for ${
                formatDuration(responseCCDirectives['stale-if-error']!)
            } after the response expires.
        ` :
        responseCCDirectives['stale-while-revalidate'] !== undefined ? dedent`
            The response includes a \`stale-while-revalidate\` directive set to ${
                responseCCDirectives['stale-while-revalidate']
            } seconds. This means that after the response has expired new requests
            should trigger revalidation, but the stale content can still be served in
            the meantime for ${
                formatDuration(responseCCDirectives['stale-while-revalidate']!)
            } extra.
        ` :
        responseCCDirectives['stale-if-error'] !== undefined ? dedent`
            The response includes a \`stale-if-error\` directive set to ${
                responseCCDirectives['stale-if-error']
            } seconds. This means that after the response has expired, new
            requests should trigger revalidation, but the stale content can still be
            served in the meantime if any errors are encountered, for ${
                formatDuration(responseCCDirectives['stale-if-error']!)
            } after the response expires.
        ` : '';

    const explainRevalidation =
        responseCCDirectives['must-revalidate'] ? dedent`
            This response includes a \`must-revalidate\` directive, which means caches must
            ensure expired content is _always_ forwarded to & revalidated by the origin server,
            and expired content must never be used, even if the server is unavailable, if
            requested explicitly, or if serving stale content has been enabled elsewhere.
        ` :
        responseCCDirectives['proxy-revalidate'] ? dedent`
            This response includes a \`proxy-revalidate\` directive, which means shared
            caches (e.g. CDNs or proxies) must ensure expired content is always forwarded
            to & revalidated by the origin server, and expired content must never be used,
            even if the server is unavailable, if requested explicitly, or if serving
            stale content has been enabled elsewhere.

            ${staleBonusBehaviour ? staleBonusBehaviour : dedent`
                It does not include a \`must-revalidate\` directive, so private client caches
                are still allowed to use stale responses if necessary.
            `}
        ` : dedent`
            ${staleBonusBehaviour}

            As the response does not include a \`must-revalidate\` directive,
            expired responses may be used if explicitly requested or necessary, for
            example if the origin server is not responding.
        `;

    if (hasNegativeLifetime) {
        return {
            summary: `Expires immediately${
                sharedMaxAge !== maxAge ?
                    ` (or after ${formatDuration(sharedMaxAge!)} for shared caches)`
                    : ''
            }${revalidationSummary}`,
            explanation: dedent`
                ${explainLifetime}.

                ${explainRevalidation}
            `
        };
    }

    const shouldSuggestImmutable =
        !responseCCDirectives['immutable'] &&
        (lifetime && lifetime >= 31536000); // 1 year

    return {
        summary:
            lifetime !== undefined ?
                `Expires after ${formatDuration(lifetime)}${
                    sharedMaxAge !== maxAge ?
                        ` (${formatDuration(sharedMaxAge!)} for shared caches)`
                        : ''
                }${revalidationSummary}`
            :
                `Expires unpredictably${
                    sharedMaxAge !== maxAge ?
                        ` for private caches, or after ${
                            formatDuration(sharedMaxAge!)
                        } for shared caches`
                        : ''
                }${revalidationSummary}`,
        type: shouldSuggestImmutable ? 'suggestion' : undefined,
        explanation: dedent`
            ${explainLifetime}.

            ${explainRevalidation}

            ${shouldSuggestImmutable ? dedent`
                :suggestion: This expiry time is more than a year away, which suggests that the
                content never changes. This could be more effective with the \`immutable\`
                Cache-Control directive, which completely avoids revalidation
                requests for this content in extra cases, such as explicit page refreshes,
                saving validation time.
            `
            : ''}
        `
    };
}