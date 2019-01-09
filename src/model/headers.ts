interface HeaderInfo {
    mdnSlug: string;
    title: string;
}

// Taken from https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers$children
// Transformed with:
// > content.subpages
// >   .keyBy(p => p.title.toLowerCase())
// >   .mapValues((p, k) => ({ mdnSlug: p.slug, title: p.title })).value()
export const HEADERS: { [key: string]: HeaderInfo | undefined } = {
    accept:{
        mdnSlug: 'Web/HTTP/Headers/Accept',
        title: 'Accept'
    },
    'accept-charset':{
        mdnSlug: 'Web/HTTP/Headers/Accept-Charset',
        title: 'Accept-Charset'
    },
    'accept-encoding':{
        mdnSlug: 'Web/HTTP/Headers/Accept-Encoding',
        title: 'Accept-Encoding'
    },
    'accept-language':{
        mdnSlug: 'Web/HTTP/Headers/Accept-Language',
        title: 'Accept-Language'
    },
    'accept-ranges':{
        mdnSlug: 'Web/HTTP/Headers/Accept-Ranges',
        title: 'Accept-Ranges'
    },
    'access-control-allow-credentials':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Allow-Credentials',
        title: 'Access-Control-Allow-Credentials'
    },
    'access-control-allow-headers':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Allow-Headers',
        title: 'Access-Control-Allow-Headers'
    },
    'access-control-allow-methods':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Allow-Methods',
        title: 'Access-Control-Allow-Methods'
    },
    'access-control-allow-origin':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Allow-Origin',
        title: 'Access-Control-Allow-Origin'
    },
    'access-control-expose-headers':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Expose-Headers',
        title: 'Access-Control-Expose-Headers'
    },
    'access-control-max-age':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Max-Age',
        title: 'Access-Control-Max-Age'
    },
    'access-control-request-headers':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Request-Headers',
        title: 'Access-Control-Request-Headers'
    },
    'access-control-request-method':{
        mdnSlug: 'Web/HTTP/Headers/Access-Control-Request-Method',
        title: 'Access-Control-Request-Method'
    },
    age:{
        mdnSlug: 'Web/HTTP/Headers/Age',
        title: 'Age'
    },
    allow:{
        mdnSlug: 'Web/HTTP/Headers/Allow',
        title: 'Allow'
    },
    'alt-svc':{
        mdnSlug: 'Web/HTTP/Headers/Alt-Svc',
        title: 'Alt-Svc'
    },
    authorization:{
        mdnSlug: 'Web/HTTP/Headers/Authorization',
        title: 'Authorization'
    },
    'cache-control':{
        mdnSlug: 'Web/HTTP/Headers/Cache-Control',
        title: 'Cache-Control'
    },
    'clear-site-data':{
        mdnSlug: 'Web/HTTP/Headers/Clear-Site-Data',
        title: 'Clear-Site-Data'
    },
    connection:{
        mdnSlug: 'Web/HTTP/Headers/Connection',
        title: 'Connection'
    },
    'content-disposition':{
        mdnSlug: 'Web/HTTP/Headers/Content-Disposition',
        title: 'Content-Disposition'
    },
    'content-encoding':{
        mdnSlug: 'Web/HTTP/Headers/Content-Encoding',
        title: 'Content-Encoding'
    },
    'content-language':{
        mdnSlug: 'Web/HTTP/Headers/Content-Language',
        title: 'Content-Language'
    },
    'content-length':{
        mdnSlug: 'Web/HTTP/Headers/Content-Length',
        title: 'Content-Length'
    },
    'content-location':{
        mdnSlug: 'Web/HTTP/Headers/Content-Location',
        title: 'Content-Location'
    },
    'content-range':{
        mdnSlug: 'Web/HTTP/Headers/Content-Range',
        title: 'Content-Range'
    },
    'content-security-policy':{
        mdnSlug: 'Web/HTTP/Headers/Content-Security-Policy',
        title: 'Content-Security-Policy'
    },
    'content-security-policy-report-only':{
        mdnSlug: 'Web/HTTP/Headers/Content-Security-Policy-Report-Only',
        title: 'Content-Security-Policy-Report-Only'
    },
    'content-type':{
        mdnSlug: 'Web/HTTP/Headers/Content-Type',
        title: 'Content-Type'
    },
    cookie:{
        mdnSlug: 'Web/HTTP/Headers/Cookie',
        title: 'Cookie'
    },
    cookie2:{
        mdnSlug: 'Web/HTTP/Headers/Cookie2',
        title: 'Cookie2'
    },
    dnt:{
        mdnSlug: 'Web/HTTP/Headers/DNT',
        title: 'DNT'
    },
    date:{
        mdnSlug: 'Web/HTTP/Headers/Date',
        title: 'Date'
    },
    etag:{
        mdnSlug: 'Web/HTTP/Headers/ETag',
        title: 'ETag'
    },
    'early-data':{
        mdnSlug: 'Web/HTTP/Headers/Early-Data',
        title: 'Early-Data'
    },
    expect:{
        mdnSlug: 'Web/HTTP/Headers/Expect',
        title: 'Expect'
    },
    'expect-ct':{
        mdnSlug: 'Web/HTTP/Headers/Expect-CT',
        title: 'Expect-CT'
    },
    expires:{
        mdnSlug: 'Web/HTTP/Headers/Expires',
        title: 'Expires'
    },
    'feature-policy':{
        mdnSlug: 'Web/HTTP/Headers/Feature-Policy',
        title: 'Feature-Policy'
    },
    forwarded:{
        mdnSlug: 'Web/HTTP/Headers/Forwarded',
        title: 'Forwarded'
    },
    from:{
        mdnSlug: 'Web/HTTP/Headers/From',
        title: 'From'
    },
    host:{
        mdnSlug: 'Web/HTTP/Headers/Host',
        title: 'Host'
    },
    'if-match':{
        mdnSlug: 'Web/HTTP/Headers/If-Match',
        title: 'If-Match'
    },
    'if-modified-since':{
        mdnSlug: 'Web/HTTP/Headers/If-Modified-Since',
        title: 'If-Modified-Since'
    },
    'if-none-match':{
        mdnSlug: 'Web/HTTP/Headers/If-None-Match',
        title: 'If-None-Match'
    },
    'if-range':{
        mdnSlug: 'Web/HTTP/Headers/If-Range',
        title: 'If-Range'
    },
    'if-unmodified-since':{
        mdnSlug: 'Web/HTTP/Headers/If-Unmodified-Since',
        title: 'If-Unmodified-Since'
    },
    index:{
        mdnSlug: 'Web/HTTP/Headers/Index',
        title: 'Index'
    },
    'keep-alive':{
        mdnSlug: 'Web/HTTP/Headers/Keep-Alive',
        title: 'Keep-Alive'
    },
    'large-allocation':{
        mdnSlug: 'Web/HTTP/Headers/Large-Allocation',
        title: 'Large-Allocation'
    },
    'last-modified':{
        mdnSlug: 'Web/HTTP/Headers/Last-Modified',
        title: 'Last-Modified'
    },
    location:{
        mdnSlug: 'Web/HTTP/Headers/Location',
        title: 'Location'
    },
    origin:{
        mdnSlug: 'Web/HTTP/Headers/Origin',
        title: 'Origin'
    },
    pragma:{
        mdnSlug: 'Web/HTTP/Headers/Pragma',
        title: 'Pragma'
    },
    'proxy-authenticate':{
        mdnSlug: 'Web/HTTP/Headers/Proxy-Authenticate',
        title: 'Proxy-Authenticate'
    },
    'proxy-authorization':{
        mdnSlug: 'Web/HTTP/Headers/Proxy-Authorization',
        title: 'Proxy-Authorization'
    },
    'public-key-pins':{
        mdnSlug: 'Web/HTTP/Headers/Public-Key-Pins',
        title: 'Public-Key-Pins'
    },
    'public-key-pins-report-only':{
        mdnSlug: 'Web/HTTP/Headers/Public-Key-Pins-Report-Only',
        title: 'Public-Key-Pins-Report-Only'
    },
    range:{
        mdnSlug: 'Web/HTTP/Headers/Range',
        title: 'Range'
    },
    referer:{
        mdnSlug: 'Web/HTTP/Headers/Referer',
        title: 'Referer'
    },
    'referrer-policy':{
        mdnSlug: 'Web/HTTP/Headers/Referrer-Policy',
        title: 'Referrer-Policy'
    },
    'retry-after':{
        mdnSlug: 'Web/HTTP/Headers/Retry-After',
        title: 'Retry-After'
    },
    'sec-websocket-accept':{
        mdnSlug: 'Web/HTTP/Headers/Sec-WebSocket-Accept',
        title: 'Sec-WebSocket-Accept'
    },
    server:{
        mdnSlug: 'Web/HTTP/Headers/Server',
        title: 'Server'
    },
    'server-timing':{
        mdnSlug: 'Web/HTTP/Headers/Server-Timing',
        title: 'Server-Timing'
    },
    'set-cookie':{
        mdnSlug: 'Web/HTTP/Headers/Set-Cookie',
        title: 'Set-Cookie'
    },
    'set-cookie2':{
        mdnSlug: 'Web/HTTP/Headers/Set-Cookie2',
        title: 'Set-Cookie2'
    },
    sourcemap:{
        mdnSlug: 'Web/HTTP/Headers/SourceMap',
        title: 'SourceMap'
    },
    'strict-transport-security':{
        mdnSlug: 'Web/HTTP/Headers/Strict-Transport-Security',
        title: 'Strict-Transport-Security'
    },
    te:{
        mdnSlug: 'Web/HTTP/Headers/TE',
        title: 'TE'
    },
    'timing-allow-origin':{
        mdnSlug: 'Web/HTTP/Headers/Timing-Allow-Origin',
        title: 'Timing-Allow-Origin'
    },
    tk:{
        mdnSlug: 'Web/HTTP/Headers/Tk',
        title: 'Tk'
    },
    trailer:{
        mdnSlug: 'Web/HTTP/Headers/Trailer',
        title: 'Trailer'
    },
    'transfer-encoding':{
        mdnSlug: 'Web/HTTP/Headers/Transfer-Encoding',
        title: 'Transfer-Encoding'
    },
    'upgrade-insecure-requests':{
        mdnSlug: 'Web/HTTP/Headers/Upgrade-Insecure-Requests',
        title: 'Upgrade-Insecure-Requests'
    },
    'user-agent':{
        mdnSlug: 'Web/HTTP/Headers/User-Agent',
        title: 'User-Agent'
    },
    vary:{
        mdnSlug: 'Web/HTTP/Headers/Vary',
        title: 'Vary'
    },
    via:{
        mdnSlug: 'Web/HTTP/Headers/Via',
        title: 'Via'
    },
    'www-authenticate':{
        mdnSlug: 'Web/HTTP/Headers/WWW-Authenticate',
        title: 'WWW-Authenticate'
    },
    warning:{
        mdnSlug: 'Web/HTTP/Headers/Warning',
        title: 'Warning'
    },
    'x-content-type-options':{
        mdnSlug: 'Web/HTTP/Headers/X-Content-Type-Options',
        title: 'X-Content-Type-Options'
    },
    'x-dns-prefetch-control':{
        mdnSlug: 'Web/HTTP/Headers/X-DNS-Prefetch-Control',
        title: 'X-DNS-Prefetch-Control'
    },
    'x-forwarded-for':{
        mdnSlug: 'Web/HTTP/Headers/X-Forwarded-For',
        title: 'X-Forwarded-For'
    },
    'x-forwarded-host':{
        mdnSlug: 'Web/HTTP/Headers/X-Forwarded-Host',
        title: 'X-Forwarded-Host'
    },
    'x-forwarded-proto':{
        mdnSlug: 'Web/HTTP/Headers/X-Forwarded-Proto',
        title: 'X-Forwarded-Proto'
    },
    'x-frame-options':{
        mdnSlug: 'Web/HTTP/Headers/X-Frame-Options',
        title: 'X-Frame-Options'
    },
    'x-xss-protection':{
        mdnSlug: 'Web/HTTP/Headers/X-XSS-Protection',
        title: 'X-XSS-Protection'
    }
}


export function getDocsUrl(headerName: string) {
    const headerInfo = HEADERS[headerName.toLowerCase()];

    if (!headerInfo) return undefined;

    return `https://developer.mozilla.org/en-US/docs/${headerInfo.mdnSlug}`;
}