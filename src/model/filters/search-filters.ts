import * as _ from 'lodash';

import { CollectedEvent } from '../http/events-store';
import { HttpExchange } from '../http/exchange';

import {
    charRange,
    FixedLengthNumberSyntax,
    FixedStringSyntax,
    NumberSyntax,
    StringOptionsSyntax,
    StringSyntax,
    SyntaxPart
} from './syntax-parts';

export interface Filter {
    matches(event: CollectedEvent): boolean;
    toString(): String;
}

export type FilterSet = [StringFilter, ...Filter[]] | [];

export type FilterClass = {
    new (input: string): Filter;
    filterSyntax: SyntaxPart[];
};

/**
 * Special case: this is the standard string matching filter.
 * Always exactly one used, with the raw text input from the
 * filter field, never added as a filter tag.
 */
export class StringFilter implements Filter {
    constructor(
        public readonly filter: string
    ) {}

    matches(event: CollectedEvent): boolean {
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

type NumberOperation = keyof typeof numberOperations;
type StringOperation = keyof typeof stringOperations;

class StatusFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("status"),
        new StringOptionsSyntax<NumberOperation>([
            "=",
            ">",
            ">=",
            "<",
            "<=",
            "!="
        ]),
        new FixedLengthNumberSyntax(3)
    ];

    private status: number;
    private op: NumberOperation;
    private predicate: (status: number, expectedStatus: number) => boolean;

    constructor(filter: string) {
        const opIndex = "status".length;
        const opMatch = StatusFilter.filterSyntax[1].match(filter, opIndex)!;
        this.op = filter.slice(opIndex, opIndex + opMatch.consumed) as NumberOperation;
        this.predicate = numberOperations[this.op];

        const numberIndex = opIndex + opMatch.consumed;
        this.status = parseInt(filter.slice(numberIndex), 10);
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

class CompletedFilter implements Filter {

    static filterSyntax = [new FixedStringSyntax("is-completed")]

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.isCompletedExchange();
    }

    toString() {
        return `Completed`;
    }
}

class PendingFilter implements Filter {

    static filterSyntax = [new FixedStringSyntax("is-pending")]

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            !event.isCompletedExchange();
    }

    toString() {
        return `Pending`;
    }
}

class AbortedFilter implements Filter {

    static filterSyntax = [new FixedStringSyntax("is-aborted")]

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.response === 'aborted'
    }

    toString() {
        return `Aborted`;
    }
}

class ErrorFilter implements Filter {

    static filterSyntax = [new FixedStringSyntax("is-error")]

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

class MethodFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("method"),
        new FixedStringSyntax("="),
        new StringSyntax("method", {
            allowedChars: [
                charRange('a', 'z'),
                charRange('A', 'Z')
            ]
        })
    ];

    private expectedMethod: string;

    constructor(filter: string) {
        const methodIndex = "method=".length;
        this.expectedMethod = filter.slice(methodIndex).toUpperCase();
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.request.method.toUpperCase() === this.expectedMethod;
    }

    toString() {
        return `Method = ${this.expectedMethod}`;
    }

}

class HttpVersionFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("httpVersion"),
        new FixedStringSyntax("="), // Separate, so initial suggestions are names only
        new StringOptionsSyntax(["1", "2"])
    ];

    private expectedVersion: number;

    constructor(filter: string) {
        const versionIndex = "httpVersion=".length;
        this.expectedVersion = parseInt(filter.slice(versionIndex), 10);
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.httpVersion === this.expectedVersion;
    }

    toString() {
        return `HTTP ${this.expectedVersion}`;
    }
}

class ProtocolFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("protocol"),
        new FixedStringSyntax("="),
        new StringOptionsSyntax([
            "http",
            "https"
        ])
    ];

    private expectedProtocol: string;

    constructor(filter: string) {
        const protocolIndex = "protocol=".length;
        this.expectedProtocol = filter.slice(protocolIndex).toLowerCase();
    }

    matches(event: CollectedEvent): boolean {
        if (!(event instanceof HttpExchange)) return false;

        // Parsed protocol is either http: or https: - with the colon
        const protocol = event.request.parsedUrl.protocol.toLowerCase().slice(0, -1);
        return protocol === this.expectedProtocol;
    }

    toString() {
        return `${this.expectedProtocol.toUpperCase()}`;
    }
}

class HostnameFilter implements Filter {

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
            ]
        })
    ];

    private expectedHostname: string;
    private op: StringOperation;
    private predicate: (host: string, expectedHost: string) => boolean;

    constructor(filter: string) {
        const opIndex = "hostname".length;
        const opMatch = HostnameFilter.filterSyntax[1].match(filter, opIndex)!;
        this.op = filter.slice(opIndex, opIndex + opMatch.consumed) as StringOperation;
        this.predicate = stringOperations[this.op];

        const hostIndex = opIndex + opMatch.consumed;
        this.expectedHostname = filter.slice(hostIndex).toLowerCase();
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

class PortFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("port"),
        new StringOptionsSyntax<NumberOperation>([
            "=",
            "!=",
            ">",
            ">=",
            "<",
            "<="
        ]),
        new NumberSyntax("port")
    ];

    private expectedPort: number;
    private op: NumberOperation;
    private predicate: (port: number, expectedPort: number) => boolean;

    constructor(filter: string) {
        const opIndex = "port".length;
        const opMatch = PortFilter.filterSyntax[1].match(filter, opIndex)!;
        this.op = filter.slice(opIndex, opIndex + opMatch.consumed) as NumberOperation;
        this.predicate = numberOperations[this.op];

        const portIndex = opIndex + opMatch.consumed;
        this.expectedPort = parseInt(filter.slice(portIndex), 10);
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

class PathFilter implements Filter {

    static filterSyntax = [
        new FixedStringSyntax("path"),
        new StringOptionsSyntax<StringOperation>([
            "=",
            "!=",
            "*=",
            "^=",
            "$="
        ]),
        new StringSyntax("path")
    ];

    private expectedPath: string;
    private op: StringOperation;
    private predicate: (path: string, expectedPath: string) => boolean;

    constructor(filter: string) {
        const opIndex = "path".length;
        const opMatch = PathFilter.filterSyntax[1].match(filter, opIndex)!;
        this.op = filter.slice(opIndex, opIndex + opMatch.consumed) as StringOperation;
        this.predicate = stringOperations[this.op];

        const pathIndex = opIndex + opMatch.consumed;
        this.expectedPath = filter.slice(pathIndex);
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            this.predicate(event.request.parsedUrl.pathname, this.expectedPath);
    }

    toString() {
        return `Path ${this.op} ${this.expectedPath}`;
    }
}

class QueryFilter implements Filter {

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
            allowEmpty: true
        })
    ];

    private expectedQuery: string;
    private op: StringOperation;
    private predicate: (query: string, expectedQuery: string) => boolean;

    constructor(filter: string) {
        const opIndex = "query".length;
        const opMatch = QueryFilter.filterSyntax[1].match(filter, opIndex)!;
        this.op = filter.slice(opIndex, opIndex + opMatch.consumed) as StringOperation;
        this.predicate = stringOperations[this.op];

        const queryIndex = opIndex + opMatch.consumed;
        this.expectedQuery = filter.slice(queryIndex);
    }

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            this.predicate(event.request.parsedUrl.search, this.expectedQuery);
    }

    toString() {
        return `Query ${this.op} ${this.expectedQuery}`;
    }
}

export const SelectableSearchFilterClasses: FilterClass[] = [
    StatusFilter,
    CompletedFilter,
    PendingFilter,
    AbortedFilter,
    ErrorFilter,
    MethodFilter,
    HttpVersionFilter,
    ProtocolFilter,
    HostnameFilter,
    PortFilter,
    PathFilter,
    QueryFilter,
];