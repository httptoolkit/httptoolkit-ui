/**
 * The docs included here come from MDN content, originally distributed under their
 * CC-BY-SA 2.5 license: https://creativecommons.org/licenses/by-sa/2.5/
 *
 * This license permits usage and derivative works under later equivalent versions
 * of the same license, and as such the original content used here is used under
 * the terms of CC-BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/.
 *
 * CC-BY-SA 4.0 allows derivative works to be licensed under other BY-SA compatible
 * licenses, and Creative Commons have approved GPLv3 as being an essentially
 * equivalent compatible license. As such, this derivative work is published here
 * under GPLv3 license: https://www.gnu.org/licenses/gpl-3.0.html
 *
 * This doesn't match the rest of this repository (licensed under AGPLv3), but
 * the AGPLv3 license has a specific clause that makes it compatible with
 * GPLv3 content, allowing us to combine both in a single project.
 */

interface MdnDocsData {
    mdnSlug: string;
    name: string;
    summary: string;
}

/*
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Status$children?expand&summary
 * Transformed with:
 *
 * let _ = require('lodash');
 * let statuses = require('./statuses.json');
 *
 * let output = (_(statuses.subpages)
 * .keyBy(p => p.label.split(' ')[0])
 * .mapValues((p, k) => ({
 *     name: p.title,
 *     mdnSlug: p.slug,
 *     summary: p.summary
 *     .replace(/<(.|\n)*?>/g, '')
 *     .replace(/&lt;/g, '<')
 *     .replace(/&gt;/g, '>')
 *     .replace('HyperText Transfer Protocol (HTTP)', 'HTTP')
 * }))
 * .value())
 * console.log(JSON.stringify(output, null, 4));
 */
const STATUSES: { [key: string]: MdnDocsData | undefined } = {
    "100": {
        "name": "100 Continue",
        "mdnSlug": "Web/HTTP/Status/100",
        "summary": "The HTTP 100 Continue informational status response code indicates that everything so far is OK and that the client should continue with the request or ignore it if it is already finished."
    },
    "101": {
        "name": "101 Switching Protocols",
        "mdnSlug": "Web/HTTP/Status/101",
        "summary": "The HTTP 101 Switching Protocols response code indicates the protocol the server is switching to as requested by a client which sent the message including the Upgrade request header."
    },
    "103": {
        "name": "103 Early Hints",
        "mdnSlug": "Web/HTTP/Status/103",
        "summary": "The HTTP 103 Early Hints information response status code is primarily intended to be used with the Link header to allow the user agent to start preloading resources while the server is still preparing a response."
    },
    "200": {
        "name": "200 OK",
        "mdnSlug": "Web/HTTP/Status/200",
        "summary": "The HTTP 200 OK success status response code indicates that the request has succeeded. A 200 response is cacheable by default."
    },
    "201": {
        "name": "201 Created",
        "mdnSlug": "Web/HTTP/Status/201",
        "summary": "The HTTP 201 Created success status response code indicates that the request has succeeded and has led to the creation of a resource. The new resource is effectively created before this response is sent back and the new resource is returned in the body of the message, its location being either the URL of the request, or the content of the Location header."
    },
    "202": {
        "name": "202 Accepted",
        "mdnSlug": "Web/HTTP/Status/202",
        "summary": "The HTTP 202 Accepted response status code indicates that the request has been accepted for processing, but the processing has not been completed; in fact, processing may not have started yet. The request might or might not eventually be acted upon, as it might be disallowed when processing actually takes place."
    },
    "203": {
        "name": "203 Non-Authoritative Information",
        "mdnSlug": "Web/HTTP/Status/203",
        "summary": "The HTTP 203 Non-Authoritative Information response status indicates that the request was successful but the enclosed payload has been modified by a transforming proxy from that of the origin server's 200 (OK) response ."
    },
    "204": {
        "name": "204 No Content",
        "mdnSlug": "Web/HTTP/Status/204",
        "summary": "The HTTP 204 No Content success status response code indicates that the request has succeeded, but that the client doesn't need to go away from its current page. A 204 response is cacheable by default. An ETag header is included in such a response."
    },
    "205": {
        "name": "205 Reset Content",
        "mdnSlug": "Web/HTTP/Status/205",
        "summary": "The HTTP 205 Reset Content response status tells the client to reset the document view, so for example to clear the content of a form, reset a canvas state, or to refresh the UI."
    },
    "206": {
        "name": "206 Partial Content",
        "mdnSlug": "Web/HTTP/Status/206",
        "summary": "The HTTP 206 Partial Content success status response code indicates that the request has succeeded and has the body contains the requested ranges of data, as described in the Range header of the request."
    },
    "300": {
        "name": "300 Multiple Choices",
        "mdnSlug": "Web/HTTP/Status/300",
        "summary": "The HTTP 300 Multiple Choices redirect status response code indicates that the request has more than one possible responses. The user-agent or the user should choose one of them. As there is no standardized way of choosing one of the responses, this response code is very rarely used."
    },
    "301": {
        "name": "301 Moved Permanently",
        "mdnSlug": "Web/HTTP/Status/301",
        "summary": "The HTTP 301 Moved Permanently redirect status response code indicates that the resource requested has been definitively moved to the URL given by the Location headers. A browser redirects to this page and search engines update their links to the resource (in 'SEO-speak', it is said that the 'link-juice' is sent to the new URL)."
    },
    "302": {
        "name": "302 Found",
        "mdnSlug": "Web/HTTP/Status/302",
        "summary": "The HTTP 302 Found redirect status response code indicates that the resource requested has been temporarily moved to the URL given by the Location header. A browser redirects to this page but search engines don't update their links to the resource (in 'SEO-speak', it is said that the 'link-juice' is not sent to the new URL)."
    },
    "303": {
        "name": "303 See Other",
        "mdnSlug": "Web/HTTP/Status/303",
        "summary": "The HTTP 303 See Other redirect status response code indicates that the redirects don't link to the newly uploaded resources, but to another page (such as a confirmation page or an upload progress page). This response code is usually sent back as a result of PUT or POST. The method used to display this redirected page is always GET."
    },
    "304": {
        "name": "304 Not Modified",
        "mdnSlug": "Web/HTTP/Status/304",
        "summary": "The HTTP 304 Not Modified client redirection response code indicates that there is no need to retransmit the requested resources. It is an implicit redirection to a cached resource. This happens when the request method is safe, like a GET or a HEAD request, or when the request is conditional and uses a If-None-Match or a If-Modified-Since header."
    },
    "307": {
        "name": "307 Temporary Redirect",
        "mdnSlug": "Web/HTTP/Status/307",
        "summary": "The method and the body of the original request are reused to perform the redirected request. In the cases where you want the method used to be changed to GET, use 303 See Other instead. This is useful when you want to give an answer to a PUT method that is not the uploaded resources, but a confirmation message (like \"You successfully uploaded XYZ\")."
    },
    "308": {
        "name": "308 Permanent Redirect",
        "mdnSlug": "Web/HTTP/Status/308",
        "summary": "The request method and the body will not be altered, whereas 301 may incorrectly sometimes be changed to a GET method."
    },
    "400": {
        "name": "400 Bad Request",
        "mdnSlug": "Web/HTTP/Status/400",
        "summary": "The HTTP 400 Bad Request response status code indicates that the server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing)."
    },
    "401": {
        "name": "401 Unauthorized",
        "mdnSlug": "Web/HTTP/Status/401",
        "summary": "The HTTP 401 Unauthorized client error status response code indicates that the request has not been applied because it lacks valid authentication credentials for the target resource."
    },
    "402": {
        "name": "402 Payment Required",
        "mdnSlug": "Web/HTTP/Status/402",
        "summary": "The HTTP 402 Payment Required is a nonstandard client error status response code that is reserved for future use."
    },
    "403": {
        "name": "403 Forbidden",
        "mdnSlug": "Web/HTTP/Status/403",
        "summary": "The HTTP 403 Forbidden client error status response code indicates that the server understood the request but refuses to authorize it."
    },
    "404": {
        "name": "404 Not Found",
        "mdnSlug": "Web/HTTP/Status/404",
        "summary": "The HTTP 404 Not Found client error response code indicates that the server can't find the requested resource. Links that lead to a 404 page are often called broken or dead links and can be subject to link rot."
    },
    "405": {
        "name": "405 Method Not Allowed",
        "mdnSlug": "Web/HTTP/Status/405",
        "summary": "The HTTP 405 Method Not Allowed response status code indicates that the request method is known by the server but is not supported by the target resource."
    },
    "406": {
        "name": "406 Not Acceptable",
        "mdnSlug": "Web/HTTP/Status/406",
        "summary": "The HTTP 406 Not Acceptable client error response code indicates that the server cannot produce a response matching the list of acceptable values defined in the request's proactive content negotiation headers, and that the server is unwilling to supply a default representation."
    },
    "407": {
        "name": "407 Proxy Authentication Required",
        "mdnSlug": "Web/HTTP/Status/407",
        "summary": "The HTTP 407 Proxy Authentication Required  client error status response code indicates that the request has not been applied because it lacks valid authentication credentials for a proxy server that is between the browser and the server that can access the requested resource."
    },
    "408": {
        "name": "408 Request Timeout",
        "mdnSlug": "Web/HTTP/Status/408",
        "summary": "The HTTP 408 Request Timeout response status code means that the server would like to shut down this unused connection. It is sent on an idle connection by some servers, even without any previous request by the client."
    },
    "409": {
        "name": "409 Conflict",
        "mdnSlug": "Web/HTTP/Status/409",
        "summary": "The HTTP 409 Conflict response status code indicates a request conflict with current state of the target resource."
    },
    "410": {
        "name": "410 Gone",
        "mdnSlug": "Web/HTTP/Status/410",
        "summary": "The HTTP 410 Gone client error response code indicates that access to the target resource is no longer available at the origin server and that this condition is likely to be permanent."
    },
    "411": {
        "name": "411 Length Required",
        "mdnSlug": "Web/HTTP/Status/411",
        "summary": "The HTTP 411 Length Required client error response code indicates that the server refuses to accept the request without a defined Content-Length header."
    },
    "412": {
        "name": "412 Precondition Failed",
        "mdnSlug": "Web/HTTP/Status/412",
        "summary": "The HTTP 412 Precondition Failed client error response code indicates that access to the target resource has been denied. This happens with conditional requests on methods other than GET or HEAD when the condition defined by the If-Unmodified-Since or If-None-Match headers is not fulfilled. In that case, the request, usually an upload or a modification of a resource, cannot be made and this error response is sent back."
    },
    "413": {
        "name": "413 Payload Too Large",
        "mdnSlug": "Web/HTTP/Status/413",
        "summary": "The HTTP 413 Payload Too Large response status code indicates that the request entity is larger than limits defined by server; the server might close the connection or return a Retry-After header field."
    },
    "414": {
        "name": "414 URI Too Long",
        "mdnSlug": "Web/HTTP/Status/414",
        "summary": "The HTTP 414 URI Too Long response status code indicates that the URI requested by the client is longer than the server is willing to interpret."
    },
    "415": {
        "name": "415 Unsupported Media Type",
        "mdnSlug": "Web/HTTP/Status/415",
        "summary": "The HTTP 415 Unsupported Media Type client error response code indicates that the server refuses to accept the request because the payload format is in an unsupported format."
    },
    "416": {
        "name": "416 Range Not Satisfiable",
        "mdnSlug": "Web/HTTP/Status/416",
        "summary": "The HTTP 416 Range Not Satisfiable error response code indicates that a server cannot serve the requested ranges. The most likely reason is that the document doesn't contain such ranges, or that the Range header value, though syntactically correct, doesn't make sense."
    },
    "417": {
        "name": "417 Expectation Failed",
        "mdnSlug": "Web/HTTP/Status/417",
        "summary": "The HTTP 417 Expectation Failed client error response code indicates that the expectation given in the request's Expect header could not be met."
    },
    "418": {
        "name": "418 I'm a teapot",
        "mdnSlug": "Web/HTTP/Status/418",
        "summary": "The HTTP 418 I'm a teapot client error response code indicates that the server refuses to brew coffee because it is, permanently, a teapot. A combined coffee/tea pot that is temporarily out of coffee should instead return 503. This error is a reference to Hyper Text Coffee Pot Control Protocol defined in April Fools' jokes in 1998 and 2014."
    },
    "422": {
        "name": "422 Unprocessable Entity",
        "mdnSlug": "Web/HTTP/Status/422",
        "summary": "The HTTP 422 Unprocessable Entity response status code indicates that the server understands the content type of the request entity, and the syntax of the request entity is correct, but it was unable to process the contained instructions."
    },
    "425": {
        "name": "425 Too Early",
        "mdnSlug": "Web/HTTP/Status/425",
        "summary": "The HTTP 425 Too Early response status code indicates that the server is unwilling to risk processing a request that might be replayed, which creates the potential for a replay attack."
    },
    "426": {
        "name": "426 Upgrade Required",
        "mdnSlug": "Web/HTTP/Status/426",
        "summary": "The HTTP 426 Upgrade Required client error response code indicates that the server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol."
    },
    "428": {
        "name": "428 Precondition Required",
        "mdnSlug": "Web/HTTP/Status/428",
        "summary": "The HTTP 428 Precondition Required response status code indicates that the server requires the request to be conditional."
    },
    "429": {
        "name": "429 Too Many Requests",
        "mdnSlug": "Web/HTTP/Status/429",
        "summary": "The HTTP 429 Too Many Requests response status code indicates the user has sent too many requests in a given amount of time (\"rate limiting\")."
    },
    "431": {
        "name": "431 Request Header Fields Too Large",
        "mdnSlug": "Web/HTTP/Status/431",
        "summary": "The HTTP 431 Request Header Fields Too Large response status code indicates that the server refuses to process the request because the request’s HTTP headers are too long."
    },
    "451": {
        "name": "451 Unavailable For Legal Reasons",
        "mdnSlug": "Web/HTTP/Status/451",
        "summary": "The HTTP 451 Unavailable For Legal Reasons client error response code indicates that the user requested a resource that is not available due to legal reasons, such as a web page for which a legal action has been issued."
    },
    "500": {
        "name": "500 Internal Server Error",
        "mdnSlug": "Web/HTTP/Status/500",
        "summary": "The HTTP 500 Internal Server Error server error response code indicates that the server encountered an unexpected condition that prevented it from fulfilling the request."
    },
    "501": {
        "name": "501 Not Implemented",
        "mdnSlug": "Web/HTTP/Status/501",
        "summary": "The HTTP 501 Not Implemented server error response code means that the server does not support the functionality required to fulfill the request."
    },
    "502": {
        "name": "502 Bad Gateway",
        "mdnSlug": "Web/HTTP/Status/502",
        "summary": "The HTTP 502 Bad Gateway server error response code indicates that the server, while acting as a gateway or proxy, received an invalid response from the upstream server."
    },
    "503": {
        "name": "503 Service Unavailable",
        "mdnSlug": "Web/HTTP/Status/503",
        "summary": "The HTTP 503 Service Unavailable server error response code indicates that the server is not ready to handle the request."
    },
    "504": {
        "name": "504 Gateway Timeout",
        "mdnSlug": "Web/HTTP/Status/504",
        "summary": "The HTTP 504 Gateway Timeout server error response code indicates that the server, while acting as a gateway or proxy, did not get a response in time from the upstream server that it needed in order to complete the request."
    },
    "505": {
        "name": "505 HTTP Version Not Supported",
        "mdnSlug": "Web/HTTP/Status/505",
        "summary": "The HTTP 505 HTTP Version Not Supported response status code indicates that the HTTP version used in the request is not supported by the server."
    },
    "506": {
        "name": "506 Variant Also Negotiates",
        "mdnSlug": "Web/HTTP/Status/506",
        "summary": "The HTTP 506 Variant Also Negotiates response status code may be given in the context of Transparent Content Negotiation (see RFC 2295). This protocol enables a client to retrieve the best variant of a given resource, where the server supports multiple variants."
    },
    "507": {
        "name": "507 Insufficient Storage",
        "mdnSlug": "Web/HTTP/Status/507",
        "summary": "The HTTP 507 Insufficient Storage response status code may be given in the context of the Web Distributed Authoring and Versioning (WebDAV) protocol (see RFC 4918)."
    },
    "508": {
        "name": "508 Loop Detected",
        "mdnSlug": "Web/HTTP/Status/508",
        "summary": "The HTTP 508 Loop Detected response status code may be given in the context of the Web Distributed Authoring and Versioning (WebDAV) protocol."
    },
    "510": {
        "name": "510 Not Extended",
        "mdnSlug": "Web/HTTP/Status/510",
        "summary": "The HTTP  510 Not Extended response status code is sent in the context of the HTTP Extension Framework, defined in RFC 2774."
    },
    "511": {
        "name": "511 Network Authentication Required",
        "mdnSlug": "Web/HTTP/Status/511",
        "summary": "The HTTP 511 Network Authentication Required response status code indicates that the client needs to authenticate to gain network access."
    }
};

interface RawDocsData {
    name: string;
    summary: string;
}

// Manually paraphrased from the RFC: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
const WEBSOCKET_CLOSE_CODES: { [key: string]: RawDocsData } = {
    1000: {
        "name": "Normal Closure",
        "summary": "A normal WebSocket closure, meaning that the purpose for which the connection was established has been fulfilled."
    },
    1001: {
        "name": "Going Away",
        "summary": "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page."
    },
    1002: {
        "name": "Protocol Error",
        "summary": "An endpoint terminated the connection due to a protocol error"
    },
    1003: {
        "name": "Unsupported Data",
        "summary": "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message)."
    },
    1004: {
        "name": "Reserved",
        "summary": "This close code is not used. A specific meaning might be defined in future."
    },
    1005: {
        "name": "No Close Code Received",
        "summary": "This is a reserved value that must not be sent by an endpoint. It is designated for use in applications expecting a status code, to indicate that no status code was actually present."
    },
    1006: {
        "name": "Abnormal Closure",
        "summary": "This is a reserved value that must not be sent by an endpoint. It is designated for use in applications expecting a status code, to indicate that the connection was closed abnormally, e.g., without sending or receiving a Close control frame."
    },
    1007: {
        "name": "Invalid Frame Payload Data",
        "summary": "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 data within a text message)."
    },
    1008: {
        "name": "Policy Violation",
        "summary": "An endpoint is terminating the connection because it has received a message that violates its policy. This is a generic status code that can be returned when there is no other more suitable status code (e.g., 1003 or 1009) or if there is a need to hide specific details about the policy."
    },
    1009: {
        "name": "Message Too Large",
        "summary": "An endpoint is terminating the connection because it has received a message that is too big for it to process."
    },
    1010: {
        "name": "Mandatory Extension",
        "summary": "The client is terminating the connection because it has expected the server to negotiate one or more extensions, but the server didn't return them in the response message of the WebSocket handshake.  The list of extensions that are needed SHOULD appear in the /reason/ part of the Close frame."
    },
    1011: {
        "name": "Internal Error",
        "summary": "The server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request."
    },
    1012: {
        "name": "Service Restart",
        "summary": "The server is terminating the connection because it is restarting."
    },
    1013: {
        "name": "Try Again Later",
        "summary": "The server is terminating the connection due to a temporary condition, such as being overloaded."
    },
    1014: {
        "name": "Bad Gateway",
        "summary": "The server was acting as a gateway or proxy, and received an invalid response from an upstream server."
    },
    1015: {
        "name": "TLS Handshake",
        "summary": "This is a reserved value that must not be sent by an endpoint. It is designated for use in applications expecting a status code, to indicate that the connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified)."
    }
};

/*
 * Taken from https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers$children?expand
 * Transformed with:
 *
 * let _ = require('lodash');
 * let headers = require('./headers.json');
 *
 * let output = (_(headers.subpages)
 * .filter(p => p.title !== 'Index')
 * .keyBy(p => p.title.toLowerCase())
 * .mapValues((p, k) => ({
 *   mdnSlug: p.slug,
 *   name: p.title,
 *   summary: p.summary
 *   .replace(/<(.|\n)*?>/g, '')
 *   .replace(/&lt;/g, '<')
 *   .replace(/&gt;/g, '>')
 *   .split(/\.( |$)/)[0] + '.'
 * }))
 * .value())
 * console.log(JSON.stringify(output, null, 4));
 */
const HEADERS: { [key: string]: MdnDocsData | undefined } = {
    "accept": {
        "mdnSlug": "Web/HTTP/Headers/Accept",
        "name": "Accept",
        "summary": "The Accept request HTTP header advertises which content types, expressed as MIME types, the client is able to understand."
    },
    "accept-ch": {
        "mdnSlug": "Web/HTTP/Headers/Accept-CH",
        "name": "Accept-CH",
        "summary": "The Accept-CH header is set by the server to specify which Client Hints headers a client should include in subsequent requests."
    },
    "accept-ch-lifetime": {
        "mdnSlug": "Web/HTTP/Headers/Accept-CH-Lifetime",
        "name": "Accept-CH-Lifetime",
        "summary": "The Accept-CH-Lifetime header is set by the server to specify the persistence of Accept-CH header value that specifies for which Client Hints headers client should include in subsequent requests."
    },
    "accept-charset": {
        "mdnSlug": "Web/HTTP/Headers/Accept-Charset",
        "name": "Accept-Charset",
        "summary": "The Accept-Charset request HTTP header advertises which character encodings the client understands."
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
    "accept-patch": {
        "mdnSlug": "Web/HTTP/Headers/Accept-Patch",
        "name": "Accept-Patch",
        "summary": "The Accept-Patch response HTTP header advertises which media-type the server is able to understand."
    },
    "accept-ranges": {
        "mdnSlug": "Web/HTTP/Headers/Accept-Ranges",
        "name": "Accept-Ranges",
        "summary": "The Accept-Ranges response HTTP header is a marker used by the server to advertise its support of partial requests."
    },
    "access-control-allow-credentials": {
        "mdnSlug": "Web/HTTP/Headers/Access-Control-Allow-Credentials",
        "name": "Access-Control-Allow-Credentials",
        "summary": "The Access-Control-Allow-Credentials response header tells browsers whether to expose the response to frontend JavaScript code when the request's credentials mode (Request.credentials) is include."
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
        "summary": "The Access-Control-Request-Headers request header is used by browsers when issuing a preflight request, to let the server know which HTTP headers the client might send when the actual request is made."
    },
    "access-control-request-method": {
        "mdnSlug": "Web/HTTP/Headers/Access-Control-Request-Method",
        "name": "Access-Control-Request-Method",
        "summary": "The Access-Control-Request-Method request header is used by browsers when issuing a preflight request, to let the server know which HTTP method will be used when the actual request is made."
    },
    "age": {
        "mdnSlug": "Web/HTTP/Headers/Age",
        "name": "Age",
        "summary": "The Age header contains the time in seconds the object has been in a proxy cache."
    },
    "allow": {
        "mdnSlug": "Web/HTTP/Headers/Allow",
        "name": "Allow",
        "summary": "The Allow header lists the set of methods supported by a resource."
    },
    "alt-svc": {
        "mdnSlug": "Web/HTTP/Headers/Alt-Svc",
        "name": "Alt-Svc",
        "summary": "The Alt-Svc HTTP response header is used to advertise alternative services through which the same resource can be reached."
    },
    "authorization": {
        "mdnSlug": "Web/HTTP/Headers/Authorization",
        "name": "Authorization",
        "summary": "The HTTP Authorization request header contains the credentials to authenticate a user agent with a server, usually, but not necessarily, after the server has responded with a 401 Unauthorized status and the WWW-Authenticate header."
    },
    "cache-control": {
        "mdnSlug": "Web/HTTP/Headers/Cache-Control",
        "name": "Cache-Control",
        "summary": "The Cache-Control HTTP header holds directives (instructions) for caching in both requests and responses."
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
        "summary": "In a regular HTTP response, the Content-Disposition response header is a header indicating if the content is expected to be displayed inline in the browser, that is, as a Web page or as part of a Web page, or as an attachment, that is downloaded and saved locally."
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
    "cross-origin-embedder-policy": {
        "mdnSlug": "Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
        "name": "Cross-Origin-Embedder-Policy",
        "summary": "The HTTP Cross-Origin-Embedder-Policy (COEP) response header prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS)."
    },
    "cross-origin-opener-policy": {
        "mdnSlug": "Web/HTTP/Headers/Cross-Origin-Opener-Policy",
        "name": "Cross-Origin-Opener-Policy",
        "summary": "The HTTP Cross-Origin-Opener-Policy (COOP) response header allows you to ensure a top-level document does not share a browsing context group with cross-origin documents."
    },
    "cross-origin-resource-policy": {
        "mdnSlug": "Web/HTTP/Headers/Cross-Origin-Resource-Policy",
        "name": "Cross-Origin-Resource-Policy",
        "summary": "The HTTP Cross-Origin-Resource-Policy response header conveys a desire that the browser blocks no-cors cross-origin/cross-site requests to the given resource."
    },
    "dnt": {
        "mdnSlug": "Web/HTTP/Headers/DNT",
        "name": "DNT",
        "summary": "The DNT (Do Not Track) request header indicates the user's tracking preference."
    },
    "dpr": {
        "mdnSlug": "Web/HTTP/Headers/DPR",
        "name": "DPR",
        "summary": "The DPR header is a Client Hints headers which represents the client device pixel ratio (DPR), which is the the number of physical device pixels corresponding to every CSS pixel."
    },
    "date": {
        "mdnSlug": "Web/HTTP/Headers/Date",
        "name": "Date",
        "summary": "The Date general HTTP header contains the date and time at which the message was originated."
    },
    "device-memory": {
        "mdnSlug": "Web/HTTP/Headers/Device-Memory",
        "name": "Device-Memory",
        "summary": "The Device-Memory header is a Device Memory API header that works like Client Hints header which represents the approximate amount of RAM client device has."
    },
    "digest": {
        "mdnSlug": "Web/HTTP/Headers/Digest",
        "name": "Digest",
        "summary": "The Digest response HTTP header provides a digest of the requested resource."
    },
    "etag": {
        "mdnSlug": "Web/HTTP/Headers/ETag",
        "name": "ETag",
        "summary": "The ETag HTTP response header is an identifier for a specific version of a resource."
    },
    "early-data": {
        "mdnSlug": "Web/HTTP/Headers/Early-Data",
        "name": "Early-Data",
        "summary": "The Early-Data header is set by an intermediary to indicate that the request has been conveyed in TLS early data, and also indicates that the intermediary understands the 425 (Too Early) status code."
    },
    "expect": {
        "mdnSlug": "Web/HTTP/Headers/Expect",
        "name": "Expect",
        "summary": "The Expect HTTP request header indicates expectations that need to be fulfilled by the server in order to properly handle the request."
    },
    "expect-ct": {
        "mdnSlug": "Web/HTTP/Headers/Expect-CT",
        "name": "Expect-CT",
        "summary": "The Expect-CT header lets sites opt in to reporting and/or enforcement of Certificate Transparency requirements, to prevent the use of misissued certificates for that site from going unnoticed."
    },
    "expires": {
        "mdnSlug": "Web/HTTP/Headers/Expires",
        "name": "Expires",
        "summary": "The Expires header contains the date/time after which the response is considered stale."
    },
    "feature-policy": {
        "mdnSlug": "Web/HTTP/Headers/Feature-Policy",
        "name": "Feature-Policy",
        "summary": "The HTTP Feature-Policy header provides a mechanism to allow and deny the use of browser features in its own frame, and in content within any <iframe> elements in the document."
    },
    "forwarded": {
        "mdnSlug": "Web/HTTP/Headers/Forwarded",
        "name": "Forwarded",
        "summary": "The Forwarded header contains information from the reverse proxy servers that is altered or lost when a proxy is involved in the path of the request."
    },
    "from": {
        "mdnSlug": "Web/HTTP/Headers/From",
        "name": "From",
        "summary": "The From request header contains an Internet email address for a human user who controls the requesting user agent."
    },
    "host": {
        "mdnSlug": "Web/HTTP/Headers/Host",
        "name": "Host",
        "summary": "The Host request header specifies the host and port number of the server to which the request is being sent."
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
    "link": {
        "mdnSlug": "Web/HTTP/Headers/Link",
        "name": "Link",
        "summary": "The HTTP Link entity-header field provides a means for serialising one or more links in HTTP headers."
    },
    "location": {
        "mdnSlug": "Web/HTTP/Headers/Location",
        "name": "Location",
        "summary": "The Location response header indicates the URL to redirect a page to."
    },
    "nel": {
        "mdnSlug": "Web/HTTP/Headers/NEL",
        "name": "NEL",
        "summary": "The HTTP NEL response header is used to configure network request logging."
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
        "summary": "The HTTP Public-Key-Pins response header used to associate a specific cryptographic public key with a certain web server to decrease the risk of MITM attacks with forged certificates, however, it has been removed from modern browsers and is no longer supported."
    },
    "public-key-pins-report-only": {
        "mdnSlug": "Web/HTTP/Headers/Public-Key-Pins-Report-Only",
        "name": "Public-Key-Pins-Report-Only",
        "summary": "The HTTP Public-Key-Pins-Report-Only response header was used to send reports of pinning violation to the report-uri specified in the header but, unlike Public-Key-Pins still allows browsers to connect to the server if the pinning is violated."
    },
    "range": {
        "mdnSlug": "Web/HTTP/Headers/Range",
        "name": "Range",
        "summary": "The Range HTTP request header indicates the part of a document that the server should return."
    },
    "referer": {
        "mdnSlug": "Web/HTTP/Headers/Referer",
        "name": "Referer",
        "summary": "The Referer request header contains the address of the page making the request."
    },
    "referrer-policy": {
        "mdnSlug": "Web/HTTP/Headers/Referrer-Policy",
        "name": "Referrer-Policy",
        "summary": "The Referrer-Policy HTTP header controls how much referrer information (sent via the Referer header) should be included with requests."
    },
    "retry-after": {
        "mdnSlug": "Web/HTTP/Headers/Retry-After",
        "name": "Retry-After",
        "summary": "The Retry-After response HTTP header indicates how long the user agent should wait before making a follow-up request."
    },
    "save-data": {
        "mdnSlug": "Web/HTTP/Headers/Save-Data",
        "name": "Save-Data",
        "summary": "The Save-Data header field is a boolean which, in requests, indicates the client's preference for reduced data usage."
    },
    "sec-fetch-dest": {
        "mdnSlug": "Web/HTTP/Headers/Sec-Fetch-Dest",
        "name": "Sec-Fetch-Dest",
        "summary": "The Sec-Fetch-Dest fetch metadata header indicates the request's destination, that is how the fetched data will be used."
    },
    "sec-fetch-mode": {
        "mdnSlug": "Web/HTTP/Headers/Sec-Fetch-Mode",
        "name": "Sec-Fetch-Mode",
        "summary": "The Sec-Fetch-Mode fetch metadata header indicates the request's mode."
    },
    "sec-fetch-site": {
        "mdnSlug": "Web/HTTP/Headers/Sec-Fetch-Site",
        "name": "Sec-Fetch-Site",
        "summary": "The Sec-Fetch-Site fetch metadata header indicates the relationship between a request initiator's origin and the origin of the resource."
    },
    "sec-fetch-user": {
        "mdnSlug": "Web/HTTP/Headers/Sec-Fetch-User",
        "name": "Sec-Fetch-User",
        "summary": "The Sec-Fetch-User fetch metadata header indicates whether or not a navigation request was triggered by a user activation."
    },
    "sec-websocket-accept": {
        "mdnSlug": "Web/HTTP/Headers/Sec-WebSocket-Accept",
        "name": "Sec-WebSocket-Accept",
        "summary": "The Sec-WebSocket-Accept header is used in the websocket opening handshake."
    },
    "server": {
        "mdnSlug": "Web/HTTP/Headers/Server",
        "name": "Server",
        "summary": "The Server header describes the software used by the origin server that handled the request — that is, the server that generated the response."
    },
    "server-timing": {
        "mdnSlug": "Web/HTTP/Headers/Server-Timing",
        "name": "Server-Timing",
        "summary": "The Server-Timing header communicates one or more metrics and descriptions for a given request-response cycle."
    },
    "set-cookie": {
        "mdnSlug": "Web/HTTP/Headers/Set-Cookie",
        "name": "Set-Cookie",
        "summary": "The Set-Cookie HTTP response header is used to send a cookie from the server to the user agent, so the user agent can send it back to the server later."
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
        "summary": "The Transfer-Encoding header specifies the form of encoding used to safely transfer the payload body to the user."
    },
    "upgrade-insecure-requests": {
        "mdnSlug": "Web/HTTP/Headers/Upgrade-Insecure-Requests",
        "name": "Upgrade-Insecure-Requests",
        "summary": "The HTTP Upgrade-Insecure-Requests request header sends a signal to the server expressing the client’s preference for an encrypted and authenticated response, and that it can successfully handle the upgrade-insecure-requests CSP directive."
    },
    "user-agent": {
        "mdnSlug": "Web/HTTP/Headers/User-Agent",
        "name": "User-Agent",
        "summary": "The User-Agent request header is a characteristic string that lets servers and network peers identify the application, operating system, vendor, and/or version of the requesting user agent."
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
    "want-digest": {
        "mdnSlug": "Web/HTTP/Headers/Want-Digest",
        "name": "Want-Digest",
        "summary": "The Want-Digest HTTP header is primarily used in a HTTP request, to ask the responder to provide a digest of the requested resource using the Digest response header."
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
        "summary": "The X-Frame-Options HTTP response header can be used to indicate whether or not a browser should be allowed to render a page in a <frame>, <iframe>, <embed> or <object>."
    },
    "x-xss-protection": {
        "mdnSlug": "Web/HTTP/Headers/X-XSS-Protection",
        "name": "X-XSS-Protection",
        "summary": "The HTTP X-XSS-Protection response header is a feature of Internet Explorer, Chrome and Safari that stops pages from loading when they detect reflected cross-site scripting (XSS) attacks."
    }
};

/*
 * Taken from https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods$children?expand
 * Transformed with:
 *
 * let _ = require('lodash');
 * let methods = require('./methods.json');
 * let output = (_(methods.subpages)
 * .keyBy(p => p.title.toLowerCase())
 * .mapValues((p, k) => ({
 *     mdnSlug: p.slug,
 *     name: p.title,
 *     summary: p.summary
 *     .replace(/<(.|\n)*?>/g, '')
 *     .replace(/&lt;/g, '<')
 *     .replace(/&gt;/g, '>')
 *     .split(/\.( |$)/)[0] + '.'
 * }))
 * .value())
 * console.log(JSON.stringify(output, null, 4));
 */
const METHODS: { [key: string]: MdnDocsData | undefined } = {
    "connect": {
        "mdnSlug": "Web/HTTP/Methods/CONNECT",
        "name": "CONNECT",
        "summary": "The HTTP CONNECT method starts two-way communications with the requested resource."
    },
    "delete": {
        "mdnSlug": "Web/HTTP/Methods/DELETE",
        "name": "DELETE",
        "summary": "The HTTP DELETE request method deletes the specified resource."
    },
    "get": {
        "mdnSlug": "Web/HTTP/Methods/GET",
        "name": "GET",
        "summary": "The HTTP GET method requests a representation of the specified resource."
    },
    "head": {
        "mdnSlug": "Web/HTTP/Methods/HEAD",
        "name": "HEAD",
        "summary": "The HTTP HEAD method requests the headers that would be returned if the HEAD request's URL was instead requested with the HTTP GET method."
    },
    "options": {
        "mdnSlug": "Web/HTTP/Methods/OPTIONS",
        "name": "OPTIONS",
        "summary": "The HTTP OPTIONS method requests permitted communication options for a given URL or server."
    },
    "patch": {
        "mdnSlug": "Web/HTTP/Methods/PATCH",
        "name": "PATCH",
        "summary": "The HTTP PATCH request method applies partial modifications to a resource."
    },
    "post": {
        "mdnSlug": "Web/HTTP/Methods/POST",
        "name": "POST",
        "summary": "The HTTP POST method sends data to the server."
    },
    "put": {
        "mdnSlug": "Web/HTTP/Methods/PUT",
        "name": "PUT",
        "summary": "The HTTP PUT request method creates a new resource or replaces a representation of the target resource with the request payload."
    },
    "trace": {
        "mdnSlug": "Web/HTTP/Methods/TRACE",
        "name": "TRACE",
        "summary": "The HTTP TRACE method performs a message loop-back test along the path to the target resource, providing a useful debugging mechanism."
    }
};

type DocsInfo = {
    url: string,
    name: string;
    summary: string;
};

function getDocs(
    data: { [key: string]: MdnDocsData | undefined },
    key: string
): DocsInfo | undefined {
    const docsInfo = data[key];

    if (!docsInfo) return undefined;
    return {
        url: `https://developer.mozilla.org/en-US/docs/${docsInfo.mdnSlug}`,
        name: docsInfo.name,
        summary: docsInfo.summary
    };
}

export function getHeaderDocs(headerName: string) {
    return getDocs(HEADERS, headerName.toLowerCase());
}

type StatusDocsInfo = DocsInfo & { message: string };

export function getStatusDocs(statusCode: string | number) {
    const statusDocs = getDocs(STATUSES, statusCode.toString()) as Partial<StatusDocsInfo>;
    if (!statusDocs) return;

    statusDocs.message = statusDocs.name!.split(' ').slice(1).join(' ');
    return statusDocs as StatusDocsInfo;
}

export function getWebSocketCloseCodeDocs(closeCode: string | number | undefined) {
    if (!closeCode) return;
    return WEBSOCKET_CLOSE_CODES[closeCode.toString()];
}

export const METHOD_NAMES = (Object.values(METHODS) as MdnDocsData[])
    .map(({ name }) => name.toUpperCase());

export function getMethodDocs(methodName: string) {
    return getDocs(METHODS, methodName.toLowerCase());
}

export function getStatusMessage(statusCode: number | undefined) {
    if (!statusCode) return '';

    const statusData = STATUSES[statusCode.toString()];

    if (!statusData) return '';
    return statusData.name.slice(4); // Drop the 'XXX ' prefix.
}