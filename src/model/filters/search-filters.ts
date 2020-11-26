import * as _ from 'lodash';

import { CollectedEvent } from '../http/events-store';
import { HttpExchange } from '../http/exchange';
import { getStatusDocs } from '../http/http-docs';

import {
    charRange,
    FixedLengthNumberSyntax,
    FixedStringSyntax,
    NumberSyntax,
    OptionalSyntax,
    StringOptionsSyntax,
    StringSyntax,
    SyntaxPart,
    SyntaxPartValue
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
        return thisClass.filterDescription(
            this.filterString,
            false
        );
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
};

/**
 * Special case: this is the standard string matching filter.
 * Always exactly one used, with the raw text input from the
 * filter field, never added as a filter tag.
 */
export class StringFilter extends Filter {
    constructor(
        public readonly filter: string
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
}

// Note that all operations here are implicitly case-sensitive, but it's expected
// that each matcher will lower/uppercase values for matching as part of parsing.
const stringOperations = {
    ...operations,
    "*=": (value: string, expected: string) => value.includes(expected),
    "^=": (value: string, expected: string) => value.startsWith(expected),
    "$=": (value: string, expected: string) => value.endsWith(expected)
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

type SyntaxPartValues<
    SPs extends readonly SyntaxPart<any, any>[]
> = {
    [K in keyof SPs]: SyntaxPartValue<SPs[K]>
};

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

    static filterDescription(value: string) {
        const [, op, status] = tryParseFilter(StatusFilter, value);

        if (!op || (op == '=' && !status)) {
            return "Match responses with a given status code";
        } else if (!status) {
            return `Match responses with a status ${operationDescriptions[op]} a given value`
        } else {
            const statusMessage = getStatusDocs(status)?.message;

            // For exact matches, include the status description for easy reference
            const describeStatus = (op === '=' || op === '!=') && statusMessage
                ? ` (${statusMessage})`
                : '';

            if (op === '=') {
                // Simplify descriptions for the most common case
                return `Match responses with status ${status}${describeStatus}`;
            } else {
                return `Match responses with a status ${
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
        return event instanceof HttpExchange &&
            event.isSuccessfulExchange() &&
            this.predicate(event.response.statusCode, this.status);
    }

    toString() {
        return `Status ${this.op} ${this.status}`;
    }
}

class CompletedFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("completed")] as const;

    static filterDescription(value: string) {
        return "Match requests that have received a response";
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.isSuccessfulExchange();
    }

    toString() {
        return `Completed`;
    }
}

class PendingFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("pending")];

    static filterDescription(value: string) {
        return "Match requests that are still waiting for a response";
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            !event.isCompletedExchange();
    }

    toString() {
        return `Pending`;
    }
}

class AbortedFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("aborted")] as const;

    static filterDescription(value: string) {
        return "Match requests that aborted before receiving a response";
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.response === 'aborted'
    }

    toString() {
        return `Aborted`;
    }
}

class ErrorFilter extends Filter {

    static filterSyntax = [new FixedStringSyntax("errored")] as const;

    static filterDescription(value: string) {
        return "Match requests that weren't transmitted successfully";
    }

    matches(event: CollectedEvent): boolean {
        return !(event instanceof HttpExchange) || // TLS Error
            event.tags.some(tag =>
                tag.startsWith('client-error') ||
                tag.startsWith('passthrough-error')
            );
    }

    toString() {
        return `Error`;
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
            allowedChars: [
                charRange('a', 'z'),
                charRange('A', 'Z')
            ],
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => 'request' in e && e.request.method)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterDescription(value: string) {
        const [, op, method] = tryParseFilter(MethodFilter, value);

        if (!op) {
            return "Match requests with a given method";
        } else if (op === '=') {
            if (method) {
                return `Match ${method.toUpperCase()} requests`;
            } else {
                return `Match requests with a given method`;
            }
        } else {
            if (method) {
                return `Match non-${method.toUpperCase()} requests`;
            } else {
                return 'Match requests not sent with a given method';
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
        return event instanceof HttpExchange &&
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

    static filterDescription(value: string) {
        const [, , version] = tryParseFilter(HttpVersionFilter, value);

        if (!version) {
            return "Match exchanges using a given version of HTTP";
        } else {
            return `Match exchanges using HTTP/${version}`;
        }
    }

    private expectedVersion: number;

    constructor(filter: string) {
        super(filter);
        const [,, versionString] = parseFilter(HttpVersionFilter, filter);
        this.expectedVersion = parseInt(versionString, 10);
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.httpVersion === this.expectedVersion;
    }

    toString() {
        return `HTTP ${this.expectedVersion}`;
    }
}

class ProtocolFilter extends Filter {

    static filterSyntax = [
        new FixedStringSyntax("protocol"),
        new FixedStringSyntax("="),
        new StringOptionsSyntax([
            "http",
            "https"
        ])
    ] as const;

    static filterDescription(value: string) {
        const [, , protocol] = tryParseFilter(ProtocolFilter, value);

        if (!protocol) {
            return "Match exchanges using either HTTP or HTTPS";
        } else {
            return `Match exchanges using ${protocol.toUpperCase()}`;
        }
    }

    private expectedProtocol: string;

    constructor(filter: string) {
        super(filter);
        const [,, protocol] = parseFilter(ProtocolFilter, filter);
        this.expectedProtocol = protocol.toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        if (!(event instanceof HttpExchange)) return false;

        // Parsed protocol is either http: or https:, so we strip the colon
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
                charRange("a", "z"),
                charRange("A", "Z"),
                charRange("0", "9"),
                charRange("-"),
                charRange(".")
            ],
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => 'request' in e && e.request.parsedUrl.hostname.toLowerCase())
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterDescription(value: string) {
        const [, op, hostname] = tryParseFilter(HostnameFilter, value);

        if (!op || (!hostname && op === '=')) {
            return "Match requests sent to a given hostname";
        } else if (op === '=') {
            return `Match requests to ${hostname}`;
        } else {
            return `Match requests to a hostname ${operationDescriptions[op]} ${hostname || 'a given value'}`;
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
        return event instanceof HttpExchange &&
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

    static filterDescription(value: string) {
        const [, op, port] = tryParseFilter(PortFilter, value);

        if (!op || (!port && op === '=')) {
            return "Match requests sent to a given port";
        } else if (op === '=') {
            return `Match requests to port ${port}`;
        } else {
            return `Match requests to a port ${operationDescriptions[op]} ${port || 'a given port'}`;
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
        if (!(event instanceof HttpExchange)) return false;

        const { protocol, port: explicitPort } = event.request.parsedUrl;
        const port = parseInt((
            explicitPort ||
            PROTOCOL_DEFAULT_PORTS[protocol as 'http:' | 'https:'] ||
            0
        ).toString(), 10);

        return event instanceof HttpExchange &&
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
                .map(e => 'request' in e && e.request.parsedUrl.pathname)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterDescription(value: string) {
        const [, op, path] = tryParseFilter(PathFilter, value);

        if (!op || (!path && op === '=')) {
            return "Match requests sent to a given path";
        } else if (op === '=') {
            return `Match requests to ${path}`;
        } else {
            return `Match requests to a path ${operationDescriptions[op]} ${path || 'a given path'}`;
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
        return event instanceof HttpExchange &&
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
            allowEmpty: (value): boolean => {
                const op = QueryFilter.filterSyntax[1].parse(value, "query".length);

                // You can pass an empty query only to = or !=
                return op === "=" || op === "!=";
            },
            suggestionGenerator: (_v, _i, events: CollectedEvent[]) =>
                _(events)
                .map(e => 'request' in e && e.request.parsedUrl.search)
                .uniq()
                .filter(Boolean)
                .valueOf() as string[]
        })
    ] as const;

    static filterDescription(value: string, isTemplate: boolean) {
        const [, op, query] = tryParseFilter(QueryFilter, value);

        if (!op) {
            return "Match requests with a given query string";
        } else if (query === undefined || isTemplate) {
            if (op === '=') {
                return `Match requests with a given query string`;
            } else {
                return `Match requests with a query string ${
                    operationDescriptions[op]
                } a given query string`;
            }
        } else if (query === '') {
            // Op must be '=' or '!=' - we don't allow empty string otherwise
            if (op === '=') {
                return 'Match requests with an empty query string';
            } else {
                return 'Match requests with a non-empty query string';
            }
        } else {
            return `Match requests with a query string ${
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
        return event instanceof HttpExchange &&
            this.predicate(event.request.parsedUrl.search, this.expectedQuery);
    }

    toString() {
        return `Query ${this.op} ${this.expectedQuery}`;
    }
}

const getAllHeaders = (e: CollectedEvent): [string, string | string[]][] => {
    if (!(e instanceof HttpExchange)) return [];
    return [
        ...Object.entries(e.request.headers),
        ...(e.isSuccessfulExchange()
            ? Object.entries(e.response.headers)
            : []
        )
    ] as [string, string | string[]][];
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
        new StringSyntax("header value", {
            suggestionGenerator: (value, _i, events: CollectedEvent[]) => {
                const headerNamePart = HeaderFilter.filterSyntax[2];
                const expectedHeaderName = headerNamePart
                    .parse(value, "header[".length)
                    .toLowerCase();

                return _(events)
                    .map(e =>
                        getAllHeaders(e)
                        .filter(([headerName]): boolean =>
                            headerName.toLowerCase() === expectedHeaderName
                        )
                        .map(([_hn, headerValue]) => headerValue)
                    )
                    .flatten()
                    .uniq()
                    .valueOf() as string[];
            }
        })
    ] as const;

    static filterSyntax = [
        new FixedStringSyntax("header"),
        new FixedStringSyntax("["),
        new StringSyntax("header name", {
            // Match any chars, except ]
            allowedChars: [
                [0, "]".charCodeAt(0) - 1],
                ["]".charCodeAt(0) + 1, 255],
            ],
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
        new FixedStringSyntax("]"),
        new OptionalSyntax<[StringOperation, string]>(...HeaderFilter.valueMatchSyntax)
    ] as const;

    static filterDescription(value: string): string {
        const [, , headerName] = tryParseFilter(HeaderFilter, value);

        // We have to manually parse optional parts unfortunately, since otherwise
        // any half-optional matches are treated as non-matches and left undefined.
        const [op, headerValue] = tryParseFilterParts(
            value.slice("header[]".length + (headerName || '').length),
            ...HeaderFilter.valueMatchSyntax
        );

        if (!headerName) {
            return "Match requests or responses by header";
        } else if (!op) {
            return `Match requests or responses with a '${headerName}' header`;
        } else {
            return `Match requests or responses with '${headerName}' ${
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
        HeaderFilter.filterSyntax[4].parse;
        const [, , headerName, , [op, headerValue]] = parseFilter(HeaderFilter, filter);

        this.expectedHeaderName = headerName.toLowerCase();

        if (op && headerValue) {
            this.op = op;
            this.predicate = stringOperations[op];
            this.expectedHeaderValue = headerValue;
        }
    }

    matches(event: CollectedEvent): boolean {
        if (!(event instanceof HttpExchange)) return false;

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

export const SelectableSearchFilterClasses: FilterClass[] = [
    MethodFilter,
    HostnameFilter,
    PathFilter,
    QueryFilter,
    StatusFilter,
    HeaderFilter,
    CompletedFilter,
    PendingFilter,
    AbortedFilter,
    ErrorFilter,
    PortFilter,
    ProtocolFilter,
    HttpVersionFilter,
];