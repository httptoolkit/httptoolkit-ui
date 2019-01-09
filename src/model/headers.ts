interface HeaderInfo {
    mdnSlug: string;
    name: string;
    summary: string;
}

/*
Taken from https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers$children?expand
Transformed with:

const _ = require('lodash');
const headers = require('./headers.json');

const output = (_(headers.subpages)
.keyBy(p => p.title.toLowerCase())
.mapValues((p, k) => ({
    mdnSlug: p.slug,
    name: p.title,
    summary: p.summary.replace(/<(.|\n)*?>/g, '').split(/\.( |$)/)[0] + '.'
}))
.value())
console.log(JSON.stringify(output, null, 2));

*/
export const HEADERS: { [key: string]: HeaderInfo | undefined } = {
    "accept": {
      "mdnSlug": "Web/HTTP/Headers/Accept",
      "name": "Accept",
      "summary": "The Accept request HTTP header advertises which content types, expressed as MIME types, the client is able to understand."
    },
    "accept-charset": {
      "mdnSlug": "Web/HTTP/Headers/Accept-Charset",
      "name": "Accept-Charset",
      "summary": "The Accept-Charset request HTTP header advertises which character set the client is able to understand."
    },
    "accept-encoding": {
      "mdnSlug": "Web/HTTP/Headers/Accept-Encoding",
      "name": "Accept-Encoding",
      "summary": "The Accept-Encoding request HTTP header advertises which content encoding, usually a compression algorithm, the client is able to understand."
    },
    "accept-language": {
      "mdnSlug": "Web/HTTP/Headers/Accept-Language",
      "name": "Accept-Language",
      "summary": "The Accept-Language request HTTP header advertises which languages the client is able to understand, and which locale variant is preferred."
    },
    "accept-ranges": {
      "mdnSlug": "Web/HTTP/Headers/Accept-Ranges",
      "name": "Accept-Ranges",
      "summary": "The Accept-Ranges response HTTP header is a marker used by the server to advertise its support of partial requests."
    },
    "access-control-allow-credentials": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Allow-Credentials",
      "name": "Access-Control-Allow-Credentials",
      "summary": "The Access-Control-Allow-Credentials response header tells browsers whether to expose the response to frontend JavaScript code when the request's credentials mode (Request.credentials) is \"include\"."
    },
    "access-control-allow-headers": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Allow-Headers",
      "name": "Access-Control-Allow-Headers",
      "summary": "The Access-Control-Allow-Headers response header is used in response to a preflight request which includes the Access-Control-Request-Headers to indicate which HTTP headers can be used during the actual request."
    },
    "access-control-allow-methods": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Allow-Methods",
      "name": "Access-Control-Allow-Methods",
      "summary": "The Access-Control-Allow-Methods response header specifies the method or methods allowed when accessing the resource in response to a preflight request."
    },
    "access-control-allow-origin": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Allow-Origin",
      "name": "Access-Control-Allow-Origin",
      "summary": "The Access-Control-Allow-Origin response header indicates whether the response can be shared with requesting code from the given origin."
    },
    "access-control-expose-headers": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Expose-Headers",
      "name": "Access-Control-Expose-Headers",
      "summary": "The Access-Control-Expose-Headers response header indicates which headers can be exposed as part of the response by listing their names."
    },
    "access-control-max-age": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Max-Age",
      "name": "Access-Control-Max-Age",
      "summary": "The Access-Control-Max-Age response header indicates how long the results of a preflight request (that is the information contained in the Access-Control-Allow-Methods and Access-Control-Allow-Headers headers) can be cached."
    },
    "access-control-request-headers": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Request-Headers",
      "name": "Access-Control-Request-Headers",
      "summary": "The Access-Control-Request-Headers request header is used when issuing a preflight request to let the server know which HTTP headers will be used when the actual request is made."
    },
    "access-control-request-method": {
      "mdnSlug": "Web/HTTP/Headers/Access-Control-Request-Method",
      "name": "Access-Control-Request-Method",
      "summary": "The Access-Control-Request-Method request header is used when issuing a preflight request to let the server know which HTTP method will be used when the actual request is made."
    },
    "age": {
      "mdnSlug": "Web/HTTP/Headers/Age",
      "name": "Age",
      "summary": "The Age header contains the time in seconds the object has been in a proxy cache."
    },
    "allow": {
      "mdnSlug": "Web/HTTP/Headers/Allow",
      "name": "Allow",
      "summary": "The Allow header lists the set of methods support by a resource."
    },
    "alt-svc": {
      "mdnSlug": "Web/HTTP/Headers/Alt-Svc",
      "name": "Alt-Svc",
      "summary": "The Alt-Svc header is used to list alternate ways to reach this website."
    },
    "authorization": {
      "mdnSlug": "Web/HTTP/Headers/Authorization",
      "name": "Authorization",
      "summary": "The HTTP Authorization request header contains the credentials to authenticate a user agent with a server, usually after the server has responded with a 401 Unauthorized status and the WWW-Authenticate header."
    },
    "cache-control": {
      "mdnSlug": "Web/HTTP/Headers/Cache-Control",
      "name": "Cache-Control",
      "summary": "The Cache-Control general-header field is used to specify directives for caching mechanisms in both requests and responses."
    },
    "clear-site-data": {
      "mdnSlug": "Web/HTTP/Headers/Clear-Site-Data",
      "name": "Clear-Site-Data",
      "summary": "The Clear-Site-Data header clears browsing data (cookies, storage, cache) associated with the requesting website."
    },
    "connection": {
      "mdnSlug": "Web/HTTP/Headers/Connection",
      "name": "Connection",
      "summary": "The Connection general header controls whether or not the network connection stays open after the current transaction finishes."
    },
    "content-disposition": {
      "mdnSlug": "Web/HTTP/Headers/Content-Disposition",
      "name": "Content-Disposition",
      "summary": "In a multipart/form-data body, the HTTP Content-Disposition general header is a header that can be used on the subpart of a multipart body to give information about the field it applies to."
    },
    "content-encoding": {
      "mdnSlug": "Web/HTTP/Headers/Content-Encoding",
      "name": "Content-Encoding",
      "summary": "The Content-Encoding entity header is used to compress the media-type."
    },
    "content-language": {
      "mdnSlug": "Web/HTTP/Headers/Content-Language",
      "name": "Content-Language",
      "summary": "The Content-Language entity header is used to describe the language(s) intended for the audience, so that it allows a user to differentiate according to the users' own preferred language."
    },
    "content-length": {
      "mdnSlug": "Web/HTTP/Headers/Content-Length",
      "name": "Content-Length",
      "summary": "The Content-Length entity header indicates the size of the entity-body, in bytes, sent to the recipient."
    },
    "content-location": {
      "mdnSlug": "Web/HTTP/Headers/Content-Location",
      "name": "Content-Location",
      "summary": "The Content-Location header indicates an alternate location for the returned data."
    },
    "content-range": {
      "mdnSlug": "Web/HTTP/Headers/Content-Range",
      "name": "Content-Range",
      "summary": "The Content-Range response HTTP header indicates where in a full body message a partial message belongs."
    },
    "content-security-policy": {
      "mdnSlug": "Web/HTTP/Headers/Content-Security-Policy",
      "name": "Content-Security-Policy",
      "summary": "The HTTP Content-Security-Policy response header allows web site administrators to control resources the user agent is allowed to load for a given page."
    },
    "content-security-policy-report-only": {
      "mdnSlug": "Web/HTTP/Headers/Content-Security-Policy-Report-Only",
      "name": "Content-Security-Policy-Report-Only",
      "summary": "The HTTP Content-Security-Policy-Report-Only response header allows web developers to experiment with policies by monitoring (but not enforcing) their effects."
    },
    "content-type": {
      "mdnSlug": "Web/HTTP/Headers/Content-Type",
      "name": "Content-Type",
      "summary": "The Content-Type entity header is used to indicate the media type of the resource."
    },
    "cookie": {
      "mdnSlug": "Web/HTTP/Headers/Cookie",
      "name": "Cookie",
      "summary": "The Cookie HTTP request header contains stored HTTP cookies previously sent by the server with the Set-Cookie header."
    },
    "cookie2": {
      "mdnSlug": "Web/HTTP/Headers/Cookie2",
      "name": "Cookie2",
      "summary": "The obsolete Cookie2 HTTP request header used to advise the server that the user agent understands \"new-style\" cookies, but nowadays user agents will use the Cookie header instead, not this one."
    },
    "dnt": {
      "mdnSlug": "Web/HTTP/Headers/DNT",
      "name": "DNT",
      "summary": "The DNT (Do Not Track) request header indicates the user's tracking preference."
    },
    "date": {
      "mdnSlug": "Web/HTTP/Headers/Date",
      "name": "Date",
      "summary": "The Date general HTTP header contains the date and time at which the message was originated."
    },
    "etag": {
      "mdnSlug": "Web/HTTP/Headers/ETag",
      "name": "ETag",
      "summary": "The ETag HTTP response header is an identifier for a specific version of a resource."
    },
    "early-data": {
      "mdnSlug": "Web/HTTP/Headers/Early-Data",
      "name": "Early-Data",
      "summary": "The Early-Data header is set by an intermediate to indicates that the request has been conveyed in TLS early data, and additionally indicates that an intermediary understands the 425 (Too Early) status code.  The Early-Data header is not set by the originator of the request (i.e., a browser)."
    },
    "expect": {
      "mdnSlug": "Web/HTTP/Headers/Expect",
      "name": "Expect",
      "summary": "The Expect HTTP request header indicates expectations that need to be fulfilled by the server in order to properly handle the request."
    },
    "expect-ct": {
      "mdnSlug": "Web/HTTP/Headers/Expect-CT",
      "name": "Expect-CT",
      "summary": "The Expect-CT header allows sites to opt in to reporting and/or enforcement of Certificate Transparency requirements, which prevents the use of misissued certificates for that site from going unnoticed."
    },
    "expires": {
      "mdnSlug": "Web/HTTP/Headers/Expires",
      "name": "Expires",
      "summary": "The Expires header contains the date/time after which the response is considered stale."
    },
    "feature-policy": {
      "mdnSlug": "Web/HTTP/Headers/Feature-Policy",
      "name": "Feature-Policy",
      "summary": "The HTTP Feature-Policy header provides a mechanism to allow and deny the use of browser features in its own frame, and in iframes that it embeds."
    },
    "forwarded": {
      "mdnSlug": "Web/HTTP/Headers/Forwarded",
      "name": "Forwarded",
      "summary": "The Forwarded header contains information from the client-facing side of proxy servers that is altered or lost when a proxy is involved in the path of the request."
    },
    "from": {
      "mdnSlug": "Web/HTTP/Headers/From",
      "name": "From",
      "summary": "The From request header contains an Internet email address for a human user who controls the requesting user agent."
    },
    "host": {
      "mdnSlug": "Web/HTTP/Headers/Host",
      "name": "Host",
      "summary": "The Host request header specifies the domain name of the server (for virtual hosting), and (optionally) the TCP port number on which the server is listening."
    },
    "if-match": {
      "mdnSlug": "Web/HTTP/Headers/If-Match",
      "name": "If-Match",
      "summary": "The If-Match HTTP request header makes the request conditional."
    },
    "if-modified-since": {
      "mdnSlug": "Web/HTTP/Headers/If-Modified-Since",
      "name": "If-Modified-Since",
      "summary": "The If-Modified-Since request HTTP header makes the request conditional: the server will send back the requested resource, with a 200 status, only if it has been last modified after the given date."
    },
    "if-none-match": {
      "mdnSlug": "Web/HTTP/Headers/If-None-Match",
      "name": "If-None-Match",
      "summary": "The If-None-Match HTTP request header makes the request conditional."
    },
    "if-range": {
      "mdnSlug": "Web/HTTP/Headers/If-Range",
      "name": "If-Range",
      "summary": "The If-Range HTTP request header makes a range request conditional: if the condition is fulfilled, the range request will be issued and the server sends back a 206 Partial Content answer with the appropriate body."
    },
    "if-unmodified-since": {
      "mdnSlug": "Web/HTTP/Headers/If-Unmodified-Since",
      "name": "If-Unmodified-Since",
      "summary": "The If-Unmodified-Since request HTTP header makes the request conditional: the server will send back the requested resource, or accept it in the case of a POST or another non-safe method, only if it has not been last modified after the given date."
    },
    "index": {
      "mdnSlug": "Web/HTTP/Headers/Index",
      "name": "Index",
      "summary": "Found 115 pages:."
    },
    "keep-alive": {
      "mdnSlug": "Web/HTTP/Headers/Keep-Alive",
      "name": "Keep-Alive",
      "summary": "The Keep-Alive general header allows the sender to hint about how the connection may be used to set a timeout and a maximum amount of requests."
    },
    "large-allocation": {
      "mdnSlug": "Web/HTTP/Headers/Large-Allocation",
      "name": "Large-Allocation",
      "summary": "The non-standard Large-Allocation response header tells the browser that the page being loaded is going to want to perform a large allocation."
    },
    "last-modified": {
      "mdnSlug": "Web/HTTP/Headers/Last-Modified",
      "name": "Last-Modified",
      "summary": "The Last-Modified response HTTP header contains the date and time at which the origin server believes the resource was last modified."
    },
    "location": {
      "mdnSlug": "Web/HTTP/Headers/Location",
      "name": "Location",
      "summary": "The Location response header indicates the URL to redirect a page to."
    },
    "origin": {
      "mdnSlug": "Web/HTTP/Headers/Origin",
      "name": "Origin",
      "summary": "The Origin request header indicates where a fetch originates from."
    },
    "pragma": {
      "mdnSlug": "Web/HTTP/Headers/Pragma",
      "name": "Pragma",
      "summary": "The Pragma HTTP/1.0 general header is an implementation-specific header that may have various effects along the request-response chain."
    },
    "proxy-authenticate": {
      "mdnSlug": "Web/HTTP/Headers/Proxy-Authenticate",
      "name": "Proxy-Authenticate",
      "summary": "The HTTP Proxy-Authenticate response header defines the authentication method that should be used to gain access to a resource behind a proxy server."
    },
    "proxy-authorization": {
      "mdnSlug": "Web/HTTP/Headers/Proxy-Authorization",
      "name": "Proxy-Authorization",
      "summary": "The HTTP Proxy-Authorization request header contains the credentials to authenticate a user agent to a proxy server, usually after the server has responded with a 407 Proxy Authentication Required status and the Proxy-Authenticate header."
    },
    "public-key-pins": {
      "mdnSlug": "Web/HTTP/Headers/Public-Key-Pins",
      "name": "Public-Key-Pins",
      "summary": "The HTTP Public-Key-Pins response header associates a specific cryptographic public key with a certain web server to decrease the risk of MITM attacks with forged certificates."
    },
    "public-key-pins-report-only": {
      "mdnSlug": "Web/HTTP/Headers/Public-Key-Pins-Report-Only",
      "name": "Public-Key-Pins-Report-Only",
      "summary": "The HTTP Public-Key-Pins-Report-Only response header sends reports of pinning violation to the report-uri specified in the header but, unlike Public-Key-Pins still allows browsers to connect to the server if the pinning is violated."
    },
    "range": {
      "mdnSlug": "Web/HTTP/Headers/Range",
      "name": "Range",
      "summary": "The Range HTTP request header indicates the part of a document that the server should return."
    },
    "referer": {
      "mdnSlug": "Web/HTTP/Headers/Referer",
      "name": "Referer",
      "summary": "The Referer request header contains the address of the previous web page from which a link to the currently requested page was followed."
    },
    "referrer-policy": {
      "mdnSlug": "Web/HTTP/Headers/Referrer-Policy",
      "name": "Referrer-Policy",
      "summary": "The Referrer-Policy HTTP header governs which referrer information, sent in the Referer header, should be included with requests made."
    },
    "retry-after": {
      "mdnSlug": "Web/HTTP/Headers/Retry-After",
      "name": "Retry-After",
      "summary": "The Retry-After response HTTP header indicates how long the user agent should wait before making a follow-up request."
    },
    "sec-websocket-accept": {
      "mdnSlug": "Web/HTTP/Headers/Sec-WebSocket-Accept",
      "name": "Sec-WebSocket-Accept",
      "summary": "The Sec-WebSocket-Accept header is used in the websocket opening handshake."
    },
    "server": {
      "mdnSlug": "Web/HTTP/Headers/Server",
      "name": "Server",
      "summary": "The Server header contains information about the software used by the origin server to handle the request."
    },
    "server-timing": {
      "mdnSlug": "Web/HTTP/Headers/Server-Timing",
      "name": "Server-Timing",
      "summary": "The Server-Timing header communicates one or more metrics and descriptions for a given request-response cycle."
    },
    "set-cookie": {
      "mdnSlug": "Web/HTTP/Headers/Set-Cookie",
      "name": "Set-Cookie",
      "summary": "The Set-Cookie HTTP response header is used to send cookies from the server to the user agent."
    },
    "set-cookie2": {
      "mdnSlug": "Web/HTTP/Headers/Set-Cookie2",
      "name": "Set-Cookie2",
      "summary": "The obsolete Set-Cookie2 HTTP response header used to send cookies from the server to the user agent, but has been deprecated by the specification."
    },
    "sourcemap": {
      "mdnSlug": "Web/HTTP/Headers/SourceMap",
      "name": "SourceMap",
      "summary": "The SourceMap HTTP response header links generated code to a source map, enabling the browser to reconstruct the original source and present the reconstructed original in the debugger."
    },
    "strict-transport-security": {
      "mdnSlug": "Web/HTTP/Headers/Strict-Transport-Security",
      "name": "Strict-Transport-Security",
      "summary": "The HTTP Strict-Transport-Security response header (often abbreviated as HSTS) lets a web site tell browsers that it should only be accessed using HTTPS, instead of using HTTP."
    },
    "te": {
      "mdnSlug": "Web/HTTP/Headers/TE",
      "name": "TE",
      "summary": "The TE request header specifies the transfer encodings the user agent is willing to accept."
    },
    "timing-allow-origin": {
      "mdnSlug": "Web/HTTP/Headers/Timing-Allow-Origin",
      "name": "Timing-Allow-Origin",
      "summary": "The Timing-Allow-Origin response header specifies origins that are allowed to see values of attributes retrieved via features of the Resource Timing API, which would otherwise be reported as zero due to cross-origin restrictions."
    },
    "tk": {
      "mdnSlug": "Web/HTTP/Headers/Tk",
      "name": "Tk",
      "summary": "The Tk response header indicates the tracking status that applied to the corresponding request."
    },
    "trailer": {
      "mdnSlug": "Web/HTTP/Headers/Trailer",
      "name": "Trailer",
      "summary": "The Trailer response header allows the sender to include additional fields at the end of chunked messages in order to supply metadata that might be dynamically generated while the message body is sent, such as a message integrity check, digital signature, or post-processing status."
    },
    "transfer-encoding": {
      "mdnSlug": "Web/HTTP/Headers/Transfer-Encoding",
      "name": "Transfer-Encoding",
      "summary": "The Transfer-Encoding header specifies the form of encoding used to safely transfer the entity to the user."
    },
    "upgrade-insecure-requests": {
      "mdnSlug": "Web/HTTP/Headers/Upgrade-Insecure-Requests",
      "name": "Upgrade-Insecure-Requests",
      "summary": "The HTTP Upgrade-Insecure-Requests request header sends a signal to the server expressing the client’s preference for an encrypted and authenticated response, and that it can successfully handle the upgrade-insecure-requests CSP directive."
    },
    "user-agent": {
      "mdnSlug": "Web/HTTP/Headers/User-Agent",
      "name": "User-Agent",
      "summary": "The User-Agent request header contains a characteristic string that allows the network protocol peers to identify the application type, operating system, software vendor or software version of the requesting software user agent."
    },
    "vary": {
      "mdnSlug": "Web/HTTP/Headers/Vary",
      "name": "Vary",
      "summary": "The Vary HTTP response header determines how to match future request headers to decide whether a cached response can be used rather than requesting a fresh one from the origin server."
    },
    "via": {
      "mdnSlug": "Web/HTTP/Headers/Via",
      "name": "Via",
      "summary": "The Via general header is added by proxies, both forward and reverse proxies, and can appear in the request headers and the response headers."
    },
    "www-authenticate": {
      "mdnSlug": "Web/HTTP/Headers/WWW-Authenticate",
      "name": "WWW-Authenticate",
      "summary": "The HTTP WWW-Authenticate response header defines the authentication method that should be used to gain access to a resource."
    },
    "warning": {
      "mdnSlug": "Web/HTTP/Headers/Warning",
      "name": "Warning",
      "summary": "The Warning general HTTP header contains information about possible problems with the status of the message."
    },
    "x-content-type-options": {
      "mdnSlug": "Web/HTTP/Headers/X-Content-Type-Options",
      "name": "X-Content-Type-Options",
      "summary": "The X-Content-Type-Options response HTTP header is a marker used by the server to indicate that the MIME types advertised in the Content-Type headers should not be changed and be followed."
    },
    "x-dns-prefetch-control": {
      "mdnSlug": "Web/HTTP/Headers/X-DNS-Prefetch-Control",
      "name": "X-DNS-Prefetch-Control",
      "summary": "The X-DNS-Prefetch-Control HTTP response header controls DNS prefetching, a feature by which browsers proactively perform domain name resolution on both links that the user may choose to follow as well as URLs for items referenced by the document, including images, CSS, JavaScript, and so forth."
    },
    "x-forwarded-for": {
      "mdnSlug": "Web/HTTP/Headers/X-Forwarded-For",
      "name": "X-Forwarded-For",
      "summary": "The X-Forwarded-For (XFF) header is a de-facto standard header for identifying the originating IP address of a client connecting to a web server through an HTTP proxy or a load balancer."
    },
    "x-forwarded-host": {
      "mdnSlug": "Web/HTTP/Headers/X-Forwarded-Host",
      "name": "X-Forwarded-Host",
      "summary": "The X-Forwarded-Host (XFH) header is a de-facto standard header for identifying the original host requested by the client in the Host HTTP request header."
    },
    "x-forwarded-proto": {
      "mdnSlug": "Web/HTTP/Headers/X-Forwarded-Proto",
      "name": "X-Forwarded-Proto",
      "summary": "The X-Forwarded-Proto (XFP) header is a de-facto standard header for identifying the protocol (HTTP or HTTPS) that a client used to connect to your proxy or load balancer."
    },
    "x-frame-options": {
      "mdnSlug": "Web/HTTP/Headers/X-Frame-Options",
      "name": "X-Frame-Options",
      "summary": "The X-Frame-Options HTTP response header can be used to indicate whether or not a browser should be allowed to render a page in a &lt;frame&gt;, &lt;iframe&gt;, &lt;embed&gt; or &lt;object&gt;."
    },
    "x-xss-protection": {
      "mdnSlug": "Web/HTTP/Headers/X-XSS-Protection",
      "name": "X-XSS-Protection",
      "summary": "The HTTP X-XSS-Protection response header is a feature of Internet Explorer, Chrome and Safari that stops pages from loading when they detect reflected cross-site scripting (XSS) attacks."
    }
};

export function getDocsUrl(headerName: string) {
    const headerInfo = HEADERS[headerName.toLowerCase()];

    if (!headerInfo) return undefined;
    return `https://developer.mozilla.org/en-US/docs/${headerInfo.mdnSlug}`;
}

export function getDocsSummary(headerName: string) {
    const headerInfo = HEADERS[headerName.toLowerCase()];

    if (!headerInfo) return undefined;
    return headerInfo.summary;
}