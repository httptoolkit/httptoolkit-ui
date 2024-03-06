import * as _ from 'lodash';

import { CollectedEvent } from '../../types';
import { joinAnd } from '../../util/text';
import { stringToBuffer } from '../../util/buffer';

import { getStatusDocs } from '../http/http-docs';
import { getReadableSize } from '../../util/buffer';
import { EventCategories } from '../events/categorization';
import { WebSocketStream } from '../websockets/websocket-stream';

import {
    matchSyntax,
    SyntaxPart,
    SyntaxPartValues
} from './syntax-matching';
import {
    ALPHABETICAL,
    ALPHANUMERIC,
    charRange,
    CombinedSyntax,
    FixedLengthNumberSyntax,
    FixedStringSyntax,
    NumberSyntax,
    OptionalSyntax,
    OptionsSyntax,
    StringOptionsSyntax,
    StringSyntax,
    SyntaxRepeaterSyntax,
    SyntaxWrapperSyntax
} from './syntax-parts';

export abstract class Filter {

    abstract matches(event: CollectedEvent): boolean;
    abstract toString(): string;

    constructor(
        private readonly filterString: string
    ) {}

    serialize() {
        return this.filterString;
    }

    get filterDescription() {
        const thisClass = (this.constructor as FilterClass<unknown>);
        return thisClass.filterDescription(this.filterString, false);
    }
}

// A full set of filters, in reverse-UI order
export type FilterSet = readonly [StringFilter, ...Filter[]];
// A subset of filters
export type Filters = readonly Filter[];
export const emptyFilterSet = () => [new StringFilter('')] as const;

export type FilterClass<T extends unknown = never> = {
    /**
     * The constructor for the filter, which can take a string that fully matches
     * all syntax parts of this filter.
     *
     * May return multiple filters only for custom filter aliases, where a single
     * keyword expands to create a whole set of filters when created.
     */
    new (input: string): Filter | Filters;

    /**
     * A list of syntax parts that describe how to enter the filter as a string.
     *
     * Filter syntax parts may accept hint context data, of type T.
     */
    filterSyntax: readonly SyntaxPart<any, T>[];

    /**
     * A function which takes a string that fully or partially matches the
     * syntax parts for this input, and returns a human readable descriptio
     * of what the filter will do.
     *
     * If isTemplate is true, the description should assume that a template
     * value (as yet unknown) will be appended to the input.
     *
     * This function can safely assume it will never be called with strings
     * that do not match the syntax parts.
     *
     * Generally, this should get more precise as more input is entered.
     */
    filterDescription: (input: string, isTemplate: boolean) => string;

    /**
     * A very short string, just naming the type of filter, without any of
     * the input parameters etc.
     */
    filterName: string;
};

/**
 * Special case: this is the standard string matching filter.
 * Always exactly one used, with the raw text input from the
 * filter field, never added as a filter tag.
 */
export class StringFilter extends Filter {
    constructor(
        public readonly filter: string = ''
    ) {
        super(filter);
    }

    matches(event: CollectedEvent): boolean {
        if (this.filter === '') return true;
        const filter = this.filter.toLocaleLowerCase();
        return event.searchIndex.includes(filter);
    }

    toString() {
        return `"${this.filter}"`;
    }
}

const operations = {
    "=": (value: any, expected: any) => value === expected,
    "!=": (value: any, expected: any) => value !== expected
} as const;

const numberOperations = {
    ...operations,
    ">": (value: number, expected: number) => value > expected,
    ">=": (value: number, expected: number) => value >= expected,
    "<": (value: number, expected: number) => value < expected,
    "<=": (value: number, expected: number) => value <= expected
};

// Note that all operations here are implicitly case-sensitive, but it's expected
// that each matcher will lower/uppercase values for matching as part of parsing.
const stringOperations = {
    ...operations,
    "*=": (value: string, expected: string) => value.includes(expected),
    "^=": (value: string, expected: string) => value.startsWith(expected),
    "$=": (value: string, expected: string) => value.endsWith(expected)
};

const bufferOperations = {
    "=": (value: Buffer, expected: Buffer) => value.equals(expected),
    "!=": (value: Buffer, expected: Buffer) => !value.equals(expected),
    "*=": (value: Buffer, expected: Buffer) => value.includes(expected),
    "^=": (value: Buffer, expected: Buffer) => value.slice(0, expected.length).equals(expected),
    "$=": (value: Buffer, expected: Buffer) => value.slice(-expected.length).equals(expected)
};

type EqualityOperation = keyof typeof operations;
type NumberOperation = keyof typeof numberOperations;
type StringOperation = keyof typeof stringOperations;

const operationDescriptions: { [key in NumberOperation | StringOperation]: string } = {
    "=": "equal to",
    "!=": "not equal to",
    ">": "greater than",
    ">=": "greater than or equal to",
    "<": "less than",
    "<=": "less than or equal to",
    "*=": "containing",
    "^=": "starting with",
    "$=": "ending with"
} as const;

const sizeOperationDescriptions: { [key in NumberOperation]: string } = {
    ...operationDescriptions,
    ">": "larger than",
    ">=": "larger than or equal to",
    "<": "smaller than",
    "<=": "smaller than or equal to"
} as const;

type FilterPartValues<F extends FilterClass> = SyntaxPartValues<F['filterSyntax']>;

/**
 * Given that there's a full match for the given filter against the given input,
 * parse the input with the syntax array of the filter and return an array of
 * the parsed values.
 *
 * Throws an error if the value does not fully match the filter.
 */
function parseFilter<F extends FilterClass>(
    filterClass: F,
    value: string
): FilterPartValues<F> {
    let index = 0;
    const parts = [];

    for (let part of filterClass.filterSyntax) {
        parts.push(part.parse(value, index));
        index += part.match(value, index)!.consumed;
    }

    return parts as unknown as FilterPartValues<F>;
}

/**
 * Try to parse the filter, returning an array of all syntax part values that can be
 * parsed successfully, but stopping as soon as a part does not match.
 */
function tryParseFilter<F extends FilterClass>(
    filterClass: F,
    value: string
): Partial<FilterPartValues<F>> {
    return tryParseFilterParts<
        F['filterSyntax']
    >(value, ...filterClass.filterSyntax);
}

/**
 * Try to parse a specific list of filter parts, returning an array of all syntax
 * parts values that can be parsed successfully, but stopping as soon as a part
 * does not match.
 */
function tryParseFilterParts<
    SPs extends readonly SyntaxPart<any, any>[]
>(
    value: string,
    ...syntaxParts: SPs
): Partial<SyntaxPartValues<SPs>> {
    let index = 0;
    const parsedParts = [];

    for (let part of syntaxParts) {
        const match = part.match(value, index);
        if (!match || match.type !== 'full') break;

        parsedParts.push(part.parse(value, index));
        index += match.consumed;
    }

    return parsedParts as unknown as Partial<SyntaxPartValues<SPs>>;
}

class StatusFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("status"),
        new StringOptionsSyntax<NumberOperation>([
            "=",
            "!=",
            ">=",
            ">",
            "<=",
            "<"
        ]),
        new FixedLengthNumberSyntax(3, {
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e =>
                    'response' in e &&
                    e.isSuccessfulExchange() &&
                    e.response.statusCode.toString()
                )
                .uniq()
                .filter(Boolean)
                .sort()
                .valueOf() as string[]
        })
    ] as const;

    static filterName = "status";

    static filterDescription(value: string) {
        const [, op, status] = tryParseFilter(StatusFilter, value);

        if (!op || (op == '=' && !status)) {
            return "responses with a given status code";
        } else if (!status) {
            return `responses with a status ${operationDescriptions[op]} a given value`
        } else {
            const statusMessage = getStatusDocs(status)?.message;

            // For exact matches, include the status description for easy reference
            const describeStatus = (op === '=' || op === '!=') && statusMessage
                ? ` (${statusMessage})`
                : '';

            if (op === '=') {
                // Simplify descriptions for the most common case
                return `responses with status ${status}${describeStatus}`;
            } else {
                return `responses with a status ${
                    operationDescriptions[op]
                } ${status}${describeStatus}`
            }
        }
    }

    private status: number;
    private op: NumberOperation;
    private predicate: (status: number, expectedStatus: number) => boolean;

    constructor(filter: string) {
        super(filter);
        [, this.op, this.status] = parseFilter(StatusFilter, filter);
        this.predicate = numberOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            event.isSuccessfulExchange() &&
            this.predicate(event.response.statusCode, this.status);
    }

    toString() {
        return `Status ${this.op} ${this.status}`;
    }
}

class CompletedFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("completed")] as const;

    static filterName = "completed";

    static filterDescription(value: string) {
        return "requests that have received a response";
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            event.isSuccessfulExchange();
    }

    toString() {
        return `Completed`;
    }
}

class PendingFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("pending")];

    static filterName = "pending";

    static filterDescription(value: string) {
        return "requests that are still waiting for a response";
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            !event.isCompletedExchange();
    }

    toString() {
        return `Pending`;
    }
}

class AbortedFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("aborted")] as const;

    static filterName = "aborted";

    static filterDescription(value: string) {
        return "requests whose connection failed before receiving a response";
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            event.response === 'aborted'
    }

    toString() {
        return `Aborted`;
    }
}

class ErrorFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("errored")] as const;

    static filterName = "error";

    static filterDescription(value: string) {
        return "requests that weren't transmitted successfully";
    }

    matches(event: CollectedEvent): boolean {
        return !(event.isHttp()) || // TLS Error
            event.tags.some(tag =>
                tag.startsWith('client-error') ||
                tag.startsWith('passthrough-error')
            );
    }

    toString() {
        return `Error`;
    }
}

class PinnedFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("pinned")] as const;

    static filterName = "pinned";

    static filterDescription(value: string) {
        return "exchanges that are pinned";
    }

    matches(event: CollectedEvent): boolean {
        return event.pinned;
    }

    toString() {
        return `Pinned`;
    }
}

class CategoryFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("category"),
        new FixedStringSyntax("="), // Separate, so initial suggestions are names only
        new StringOptionsSyntax(EventCategories)
    ] as const;

    static filterName = "category";

    static filterDescription(value: string) {
        const [, , category] = tryParseFilter(CategoryFilter, value);

        if (!category) {
            return "exchanges by their general category";
        } else {
            return `all ${category} exchanges`;
        }
    }

    private expectedCategory: string;

    constructor(filter: string) {
        super(filter);
        const [,, categoryString] = parseFilter(CategoryFilter, filter);
        this.expectedCategory = categoryString;
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            event.category === this.expectedCategory
    }

    toString() {
        return _.startCase(this.expectedCategory);
    }
}

class MethodFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("method"),
        new StringOptionsSyntax<EqualityOperation>([
            "=",
            "!="
        ]),
        new StringSyntax("method", {
            allowedChars: ALPHABETICAL,
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => e.isHttp() && e.request.method)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterName = "method";

    static filterDescription(value: string) {
        const [, op, method] = tryParseFilter(MethodFilter, value);

        if (!op) {
            return "requests with a given method";
        } else if (op === '=') {
            if (method) {
                return `${method.toUpperCase()} requests`;
            } else {
                return `requests with a given method`;
            }
        } else {
            if (method) {
                return `non-${method.toUpperCase()} requests`;
            } else {
                return 'requests not sent with a given method';
            }
        }
    }

    private expectedMethod: string;
    private op: EqualityOperation;
    private predicate: (method: string, expectedMethod: string) => boolean;

    constructor(filter: string) {
        super(filter);
        const [, op, method] = parseFilter(MethodFilter, filter);
        this.op = op;
        this.predicate = operations[this.op];
        this.expectedMethod = method.toUpperCase();
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            this.predicate(event.request.method.toUpperCase(), this.expectedMethod);
    }

    toString() {
        return `Method ${this.op} ${this.expectedMethod}`;
    }

}

class HttpVersionFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("httpVersion"),
        new FixedStringSyntax("="), // Separate, so initial suggestions are names only
        new StringOptionsSyntax(["1", "2"])
    ] as const;

    static filterName = "httpVersion";

    static filterDescription(value: string) {
        const [, , version] = tryParseFilter(HttpVersionFilter, value);

        if (!version) {
            return "exchanges using a given version of HTTP";
        } else {
            return `exchanges using HTTP/${version}`;
        }
    }

    private expectedVersion: number;

    constructor(filter: string) {
        super(filter);
        const [,, versionString] = parseFilter(HttpVersionFilter, filter);
        this.expectedVersion = parseInt(versionString, 10);
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            event.httpVersion === this.expectedVersion;
    }

    toString() {
        return `HTTP ${this.expectedVersion}`;
    }
}

class WebSocketFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("websocket")
    ] as const;

    static filterName = "websocket";

    static filterDescription() {
        return "websocket streams";
    }

    constructor(filter: string) {
        super(filter);
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof WebSocketStream;
    }

    toString() {
        return 'WebSocket';
    }
}

class ProtocolFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("protocol"),
        new FixedStringSyntax("="),
        new StringOptionsSyntax([
            "http",
            "https",
            "ws",
            "wss"
        ])
    ] as const;

    static filterName = "protocol";

    static filterDescription(value: string) {
        const [, , protocol] = tryParseFilter(ProtocolFilter, value);

        if (!protocol) {
            return "exchanges using HTTP, HTTPS, WS or WSS";
        } else {
            return `exchanges using ${protocol.toUpperCase()}`;
        }
    }

    private expectedProtocol: string;

    constructor(filter: string) {
        super(filter);
        const [,, protocol] = parseFilter(ProtocolFilter, filter);
        this.expectedProtocol = protocol.toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        if (!(event.isHttp())) return false;

        // Parsed protocol is like 'http:', so we strip the colon
        const protocol = event.request.parsedUrl.protocol.toLowerCase().slice(0, -1);
        return protocol === this.expectedProtocol;
    }

    toString() {
        return `${this.expectedProtocol.toUpperCase()}`;
    }
}

class HostnameFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("hostname"),
        new StringOptionsSyntax<StringOperation>([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new StringSyntax("hostname", {
            allowedChars: [
                ...ALPHANUMERIC,
                charRange("-"),
                charRange(".")
            ],
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => e.isHttp() && e.request.parsedUrl.hostname.toLowerCase())
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterName = "hostname";

    static filterDescription(value: string) {
        const [, op, hostname] = tryParseFilter(HostnameFilter, value);

        if (!op || (!hostname && op === '=')) {
            return "requests sent to a given hostname";
        } else if (op === '=') {
            return `requests to ${hostname}`;
        } else {
            return `requests to a hostname ${operationDescriptions[op]} ${hostname || 'a given value'}`;
        }
    }

    private expectedHostname: string;
    private op: StringOperation;
    private predicate: (host: string, expectedHost: string) => boolean;

    constructor(filter: string) {
        super(filter);
        const [, op, hostname] = parseFilter(HostnameFilter, filter);
        this.op = op;
        this.predicate = stringOperations[op];
        this.expectedHostname = hostname.toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            this.predicate(
                event.request.parsedUrl.hostname.toLowerCase(),
                this.expectedHostname
            );
    }

    toString() {
        return `Hostname ${this.op} ${this.expectedHostname}`;
    }
}

const PROTOCOL_DEFAULT_PORTS = {
    'http:': 80,
    'https:': 443
} as const;

class PortFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("port"),
        new StringOptionsSyntax<NumberOperation>([
            "=",
            "!=",
            ">=",
            ">",
            "<=",
            "<"
        ]),
        new NumberSyntax("port")
    ] as const;

    static filterName = "port";

    static filterDescription(value: string) {
        const [, op, port] = tryParseFilter(PortFilter, value);

        if (!op || (!port && op === '=')) {
            return "requests sent to a given port";
        } else if (op === '=') {
            return `requests to port ${port}`;
        } else {
            return `requests to a port ${operationDescriptions[op]} ${port || 'a given port'}`;
        }
    }

    private expectedPort: number;
    private op: NumberOperation;
    private predicate: (port: number, expectedPort: number) => boolean;

    constructor(filter: string) {
        super(filter);
        [, this.op, this.expectedPort] = parseFilter(PortFilter, filter);
        this.predicate = numberOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        if (!(event.isHttp())) return false;

        const { protocol, port: explicitPort } = event.request.parsedUrl;
        const port = parseInt((
            explicitPort ||
            PROTOCOL_DEFAULT_PORTS[protocol as 'http:' | 'https:'] ||
            0
        ).toString(), 10);

        return event.isHttp() &&
            this.predicate(port, this.expectedPort);
    }

    toString() {
        return `Port ${this.op} ${this.expectedPort}`;
    }
}

class PathFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("path"),
        new StringOptionsSyntax<StringOperation>([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new StringSyntax("path", {
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => e.isHttp() && e.request.parsedUrl.pathname)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterName = "path";

    static filterDescription(value: string) {
        const [, op, path] = tryParseFilter(PathFilter, value);

        if (!op || (!path && op === '=')) {
            return "requests sent to a given path";
        } else if (op === '=') {
            return `requests to ${path}`;
        } else {
            return `requests to a path ${operationDescriptions[op]} ${path || 'a given path'}`;
        }
    }

    private expectedPath: string;
    private op: StringOperation;
    private predicate: (path: string, expectedPath: string) => boolean;

    constructor(filter: string) {
        super(filter);
        [, this.op, this.expectedPath] = parseFilter(PathFilter, filter);
        this.predicate = stringOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            this.predicate(event.request.parsedUrl.pathname, this.expectedPath);
    }

    toString() {
        return `Path ${this.op} ${this.expectedPath}`;
    }
}

class QueryFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("query"),
        new StringOptionsSyntax<StringOperation>([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new StringSyntax("query", {
            // We allow an empty query only with = and !=, which means we need to get the op:
            allowEmpty: (value, index): boolean => {
                // Slightly messy logic to roll backwards and find the index of the start
                // of the string operation just before this.
                const opIndex = value.slice(0, index).lastIndexOf("query") + "query".length;
                const op = QueryFilter.filterSyntax[1].parse(value, opIndex);

                // You can pass an empty query only to = or !=
                return op === "=" || op === "!=";
            },
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => e.isHttp() && e.request.parsedUrl.search)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterName = "query";

    static filterDescription(value: string, isTemplate: boolean) {
        const [, op, query] = tryParseFilter(QueryFilter, value);

        if (!op) {
            return "requests with a given query string";
        } else if (query === undefined || isTemplate) {
            if (op === '=') {
                return `requests with a given query string`;
            } else {
                return `requests with a query string ${
                    operationDescriptions[op]
                } a given query string`;
            }
        } else if (query === '') {
            // Op must be '=' or '!=' - we don't allow empty string otherwise
            if (op === '=') {
                return 'requests with an empty query string';
            } else {
                return 'requests with a non-empty query string';
            }
        } else {
            return `requests with a query string ${
                operationDescriptions[op]
            } ${
                query
            }`;
        }
    }

    private expectedQuery: string;
    private op: StringOperation;
    private predicate: (query: string, expectedQuery: string) => boolean;

    constructor(filter: string) {
        super(filter);
        [, this.op, this.expectedQuery] = parseFilter(QueryFilter, filter);
        this.predicate = stringOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        return event.isHttp() &&
            this.predicate(event.request.parsedUrl.search, this.expectedQuery);
    }

    toString() {
        return `Query ${this.op} ${this.expectedQuery}`;
    }
}

const getAllHeaders = (e: CollectedEvent): [string, string | string[]][] => {
    if (!(e.isHttp())) return [];
    return [
        ...Object.entries(e.request.headers),
        ...(e.isSuccessfulExchange()
            ? Object.entries(e.response.headers)
            : []
        )
    ] as [string, string | string[]][];
}

class HeadersFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("headers"),
        new StringOptionsSyntax([
            "=",
            "*=",
            "^=",
            "$="
        ]),
        // N.b. this is v similar to but not the same as HeaderFilter below!
        new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("header value", {
                allowedChars: [[0, 255]], // Any ASCII! Wrapper guards against spaces for us.
                suggestionGenerator: (value, index, events: CollectedEvent[]) => {
                    return _(events)
                        .map(e =>
                            _(getAllHeaders(e))
                            .map(([_hn, headerValue]) => Array.isArray(headerValue)
                                ? headerValue
                                : [headerValue]
                            )
                            .flatten()
                            .valueOf()
                        )
                        .flatten()
                        .uniq()
                        .valueOf();
                }
            }),
            // [] should be required/suggested only if value contains a space
            { optional: true }
        )
    ] as const;

    static filterName = "headers";

    static filterDescription(value: string): string {
        const [, op, headerValue] = tryParseFilter(HeadersFilter, value);

        if (!op) {
            return "exchanges by all header values";
        } else {
            return `exchanges with any header value ${
                operationDescriptions[op]
            } ${headerValue ? `'${headerValue}'` : 'a given string'}`;
        }
    }

    private expectedHeaderValue: string;
    private op: StringOperation;
    private predicate: ((headerValue: string, expectedValue: string) => boolean);

    constructor(filter: string) {
        super(filter);
        const [, op, headerValue] = parseFilter(HeadersFilter, filter);

        this.op = op;
        this.predicate = stringOperations[op];
        this.expectedHeaderValue = headerValue.toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        if (!(event.isHttp())) return false;

        const headers = getAllHeaders(event);

        const { predicate, expectedHeaderValue } = this;

        return _(headers)
            .flatMap(([_k, value]) => value ?? []) // Flatten our array/undefined values
            .some((value) => predicate(value.toLowerCase(), expectedHeaderValue));
    }

    toString() {
        return `Any header ${this.op} ${this.expectedHeaderValue!}`;
    }
}

class HeaderFilter extends Filter {

    // Separated out so we can do subparsing here ourselves
    private static valueMatchSyntax = [
        new StringOptionsSyntax([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("header value", {
                allowedChars: [[0, 255]], // Any ASCII! Wrapper guards against spaces for us.
                suggestionGenerator: (value, index, events: CollectedEvent[]) => {
                    // Find the start of the wrapped header name text that preceeds this
                    const headerNameIndex = value.slice(0, index - 1).lastIndexOf('[');

                    const headerNamePart = HeaderFilter.filterSyntax[1];
                    const expectedHeaderName = headerNamePart
                        .parse(value, headerNameIndex)
                        .toLowerCase();

                    return _(events)
                        .map(e =>
                            _(getAllHeaders(e))
                            .filter(([headerName]): boolean =>
                                headerName.toLowerCase() === expectedHeaderName
                            )
                            .map(([_hn, headerValue]) => Array.isArray(headerValue)
                                ? headerValue
                                : [headerValue]
                            )
                            .flatten()
                            .valueOf()
                        )
                        .flatten()
                        .uniq()
                        .valueOf();
                }
            }),
            // [] should be required/suggested only if value contains a space
            { optional: true }
        )
    ] as const;

    static filterSyntax = [
        new FixedStringSyntax("header"),
        new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("header name", {
                suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                    _(events)
                    .map(e =>
                        getAllHeaders(e).map(([headerName]) =>
                            headerName.toLowerCase()
                        )
                    )
                    .flatten()
                    .uniq()
                    .valueOf() as string[]
            }),
        ),
        new OptionalSyntax<[StringOperation, string]>(...HeaderFilter.valueMatchSyntax)
    ] as const;

    static filterName = "header";

    static filterDescription(value: string): string {
        const [, headerName] = tryParseFilter(HeaderFilter, value);

        // We have to manually parse optional parts unfortunately, since otherwise
        // any half-optional matches are treated as non-matches and left undefined.
        const [op, headerValue] = tryParseFilterParts(
            value.slice("header[]".length + (headerName || '').length),
            ...HeaderFilter.valueMatchSyntax
        );

        if (!headerName) {
            return "exchanges by a specific header";
        } else if (!op) {
            return `exchanges with a '${headerName}' header`;
        } else {
            return `exchanges with a '${headerName}' header ${
                operationDescriptions[op]
            } ${headerValue ? `'${headerValue}'` : 'a given value'}`;
        }
    }

    private expectedHeaderName: string;

    private expectedHeaderValue: string | undefined;

    private op: StringOperation | undefined;
    private predicate: ((headerValue: string, expectedValue: string) => boolean) | undefined;

    constructor(filter: string) {
        super(filter);
        const [, headerName, [op, headerValue]] = parseFilter(HeaderFilter, filter);

        this.expectedHeaderName = headerName.toLowerCase();

        if (op && headerValue) {
            this.op = op;
            this.predicate = stringOperations[op];
            this.expectedHeaderValue = headerValue.toLowerCase();
        }
    }

    matches(event: CollectedEvent): boolean {
        if (!(event.isHttp())) return false;

        const headers = getAllHeaders(event);

        const { predicate, expectedHeaderValue } = this;
        if (!predicate || !expectedHeaderValue) {
            return headers.some(([key]) => key.toLowerCase() === this.expectedHeaderName);
        }

        return _(headers)
            .filter(([key]) => key.toLowerCase() === this.expectedHeaderName)
            .flatMap(([_k, value]) => value ?? []) // Flatten our array/undefined values
            .some((value) => predicate(value.toLowerCase(), expectedHeaderValue));
    }

    toString() {
        if (!this.op) return `Has ${this.expectedHeaderName} header`;
        return `${this.expectedHeaderName} ${this.op} ${this.expectedHeaderValue!}`;
    }
}

class BodySizeFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("bodySize"),
        new StringOptionsSyntax<NumberOperation>([
            "=",
            "!=",
            ">=",
            ">",
            "<=",
            "<"
        ]),
        new NumberSyntax("size")
    ] as const;

    static filterName = "bodySize";

    static filterDescription(value: string) {
        const [, op, size] = tryParseFilter(BodySizeFilter, value);

        if (!op) {
            return "exchanges by body size";
        } else {
            return `exchanges with a body ${
                sizeOperationDescriptions[op]
            } ${
                size !== undefined
                ? getReadableSize(size)
                : 'a given size'
            }`;
        }
    }

    private expectedSize: number;
    private op: NumberOperation;
    private predicate: (size: number, expectedSize: number) => boolean;

    constructor(filter: string) {
        super(filter);
        [, this.op, this.expectedSize] = parseFilter(BodySizeFilter, filter);
        this.predicate = numberOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        if (!(event.isHttp())) return false;

        const requestBody = event.request.body;
        const responseBody = event.isSuccessfulExchange()
            ? event.response.body
            : undefined;
        const totalSize = requestBody.encoded.byteLength +
            (responseBody?.encoded.byteLength || 0);

        return event.isHttp() &&
            this.predicate(totalSize, this.expectedSize);
    }

    toString() {
        return `Size ${this.op} ${this.expectedSize}`;
    }
}

class BodyFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("body"),
        new StringOptionsSyntax<StringOperation>([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("body content", {
                allowedChars: [[0, Infinity]] // Match all characters, all unicode included
            }),
            // [] should be required/suggested only if value contains a space
            { optional: true }
        )
    ] as const;

    static filterName = "body";

    static filterDescription(value: string) {
        const [, op, bodyContent] = tryParseFilter(BodyFilter, value);

        if (!op) {
            return "exchanges by body content";
        } else {
            return `exchanges with a body ${operationDescriptions[op]} ${bodyContent || 'a given value'}`;
        }
    }

    private expectedBody: Buffer;

    private op: StringOperation;
    private predicate: (body: Buffer, expectedBody: Buffer) => boolean;

    constructor(filter: string) {
        super(filter);
        const [, op, expectedBody] = parseFilter(BodyFilter, filter);
        this.op = op;

        this.expectedBody = stringToBuffer(expectedBody);
        this.predicate = bufferOperations[this.op];
    }

    matches(event: CollectedEvent): boolean {
        if (!event.isHttp()) return false;
        if (!event.hasRequestBody() && !event.hasResponseBody()) return false; // No body, no match

        // Accessing .decoded on both of these touches a lazy promise, starting decoding for all bodies:
        const requestBody = event.request.body.decoded;
        const responseBody = event.isSuccessfulExchange()
            ? event.response.body.decoded
            : undefined;

        const matchesRequestBody = !!requestBody && requestBody.byteLength > 0 &&
            this.predicate(requestBody, this.expectedBody);

        const matchesResponseBody = !!responseBody && responseBody.byteLength > 0 &&
            this.predicate(responseBody, this.expectedBody);

        return matchesRequestBody || matchesResponseBody;
    }

    toString() {
        return `Body ${this.op} ${this.expectedBody}`;
    }
}

class ContainsFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("contains"),
        new SyntaxWrapperSyntax(
            ['(', ')'],
            new StringSyntax("content", {
                allowedChars: [[0, Infinity]] // Match all characters, all unicode included
            })
        )
    ] as const;

    static filterName = "contains";

    static filterDescription(value: string) {
        const [, content] = tryParseFilter(ContainsFilter, value);

        return `exchanges that contain ${
            content
            ? `'${content.toLowerCase()}'`
            : 'a given value'
        } anywhere`;
    }

    private expectedContent: string;

    constructor(filter: string) {
        super(filter);
        const [, expectedContent] = parseFilter(ContainsFilter, filter);

        this.expectedContent = expectedContent.toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        let content: Array<string | Buffer | number | undefined>;

        if (event.isHttp()) {
            content = [
                event.request.method,
                event.request.url,
                ...Object.entries(
                    event.request.rawHeaders
                ).map(([key, value]) => `${key}: ${value}`),
                // Accessing .decoded touches a lazy promise, starting decoding:
                event.request.body.decoded,

                ...(event.isSuccessfulExchange()
                    ? [
                        event.response.statusCode,
                        event.response.statusMessage,
                        ...Object.entries(
                            event.response.rawHeaders
                        ).map(([key, value]) => `${key}: ${value}`),
                        // Accessing .decoded touches a lazy promise, starting decoding:
                        event.response.body.decoded
                    ] : []
                ),

                ...(event.isWebSocket()
                    ? event.messages.map(msg => msg.content)
                    : []
                )
            ];
        } else if (event.isRTCConnection()) {
            content = [
                event.clientURL,
                event.remoteURL
            ];
        } else if (event.isRTCDataChannel()) {
            content = [
                ...event.messages.map(msg => msg.content),
                event.label,
                event.protocol
            ]
        } else if (event.isTlsTunnel()) {
            content = [
                event.upstreamHostname,
                event.upstreamPort
            ];
        } else if (event.isTlsFailure()) {
            content = [
                event.upstreamHostname
            ];
        } else {
            content = [];
        }

        return content.some(content => {
            if (!content) return false;
            if ((content as string | Buffer).length === 0) return false;
            return content
                .toString()
                .toLowerCase() // Case insensitive (expectedContent lowercased in constructor)
                .includes(this.expectedContent);
        });
    }

    toString() {
        return `Contains(${this.expectedContent})`;
    }
}

const BaseSearchFilterClasses: FilterClass[] = [
    MethodFilter,
    HostnameFilter,
    PathFilter,
    QueryFilter,
    StatusFilter,
    HeadersFilter,
    HeaderFilter,
    BodyFilter,
    BodySizeFilter,
    ContainsFilter,
    CompletedFilter,
    PendingFilter,
    AbortedFilter,
    ErrorFilter,
    PinnedFilter,
    CategoryFilter,
    PortFilter,
    ProtocolFilter,
    HttpVersionFilter,
    WebSocketFilter
];

// Meta-filters, which can wrap the base filters above:

class NotFilter extends Filter {

    private static innerFilterSyntax = new OptionsSyntax(
        BaseSearchFilterClasses.map(f =>
            new CombinedSyntax(...f.filterSyntax)
        )
    );

    static filterSyntax = [
        new FixedStringSyntax('not'),
        new SyntaxWrapperSyntax(
            ['(', ')'],
            NotFilter.innerFilterSyntax
        )
    ] as const;

    static filterName = "not";

    static filterDescription(value: string, isTemplate: boolean) {
        const innerValue = value.slice(4, -1);

        if (innerValue.length === 0) {
            return "exchanges that do not match a given condition"
        } else {
            const matches = BaseSearchFilterClasses.map((filter) => ({
                filter,
                match: matchSyntax(filter.filterSyntax, innerValue, 0)
            })).filter(({ match }) => (match?.partiallyConsumed || 0) > 0);

            const bestMatch = _.maxBy(matches, m => m.match!.partiallyConsumed);
            const innerDescription = bestMatch
                ? bestMatch.filter.filterDescription(innerValue, isTemplate)
                : '...';

            return `excluding ${innerDescription}`;
        }
    }

    private innerFilter: Filter;

    constructor(private filterValue: string) {
        super(filterValue);

        const innerValue = filterValue.slice(4, -1);

        const matchingFilterClass = _.find(BaseSearchFilterClasses, (filter) =>
            matchSyntax(filter.filterSyntax, innerValue, 0)?.type === 'full'
        )!;
        this.innerFilter = new matchingFilterClass(innerValue) as Filter; // Never Filters - we don't support filter aliases here
    }

    matches(event: CollectedEvent): boolean {
        return !this.innerFilter.matches(event);
    }

    toString() {
        return `not(${this.innerFilter.toString()})`;
    }
}

class OrFilter extends Filter {

    private static innerFilterSyntax = new SyntaxRepeaterSyntax(
        ',',
        new OptionsSyntax(
            BaseSearchFilterClasses.map(f =>
                new CombinedSyntax(...f.filterSyntax)
            )
        ),
        { placeholderName: 'condition' }
    );

    static filterSyntax = [
        new FixedStringSyntax('or'),
        new SyntaxWrapperSyntax(
            ['(', ')'],
            OrFilter.innerFilterSyntax
        )
    ] as const;

    static filterName = "or";

    static filterDescription(value: string, isTemplate: boolean) {
        if (value[value.length - 1] === ')') value = value.slice(0, -1);

        const innerValues = value.slice(3).split(',').map(v => v.trim());

        if (innerValues.length === 1 && innerValues[0].length === 0) {
            return "exchanges that match any one of multiple conditions"
        } else {
            const innerDescriptions = innerValues.map((valuePart, index) => {
                const isLastPart = index === innerValues.length - 1;
                const partIsTemplate = isTemplate && isLastPart;

                const matches = BaseSearchFilterClasses.map((filter) => ({
                    filter,
                    match: matchSyntax(filter.filterSyntax, valuePart, 0)
                })).filter(({ match }) => (match?.partiallyConsumed || 0) > 0);

                const bestMatch = _.maxBy(matches, m => m.match!.partiallyConsumed);
                if (bestMatch) {
                    return bestMatch.filter.filterDescription(valuePart, partIsTemplate);
                } else {
                    return '...';
                }
            });

            if (innerDescriptions.length < 2) {
                innerDescriptions.push('...');
            }

            return joinAnd(innerDescriptions, ', ', ', or ');
        }
    }

    private innerFilters: Filter[];

    constructor(private filterValue: string) {
        super(filterValue);

        this.innerFilters = filterValue.slice(3, -1).split(',').map(v => v.trim()).map((valuePart) => {
            const matchingFilterClass = _.find(BaseSearchFilterClasses, (filter) =>
                matchSyntax(filter.filterSyntax, valuePart, 0)?.type === 'full'
            )!;
            return new matchingFilterClass(valuePart) as Filter; // Never Filters - we don't support filter aliases here
        });
    }

    matches(event: CollectedEvent): boolean {
        return this.innerFilters.some(f => f.matches(event));
    }

    toString() {
        return joinAnd(this.innerFilters.map(f => f.toString()), ', ', ' or ');
    }
}

export const SelectableSearchFilterClasses: FilterClass[] = [
    ...BaseSearchFilterClasses,
    NotFilter,
    OrFilter
];