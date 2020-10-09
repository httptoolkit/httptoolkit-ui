import * as _ from 'lodash';

import { CollectedEvent } from '../http/events-store';
import { HttpExchange } from '../http/exchange';

import { FixedLengthNumberSyntax, FixedStringSyntax, StringOptionsSyntax, SyntaxPart } from './syntax-parts';

export interface Filter {
    matches(event: CollectedEvent): boolean;
    toString(): String;
}

export type FilterSet = [StringFilter, ...Filter[]] | [];

export type FilterClass = {
    new (input: string): Filter;

    filterName: string;
    filterDescription: string;
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
    "==": (value: any, expected: any) => value === expected,
    ">": (value: any, expected: any) => value > expected,
    ">=": (value: any, expected: any) => value >= expected,
    "<": (value: any, expected: any) => value < expected,
    "<=": (value: any, expected: any) => value <= expected
} as const;

type OperationKey = keyof typeof operations;

class StatusFilter implements Filter {

    private status: number;
    private predicate: (status: number, expectedStatus: number) => boolean;

    constructor(filter: string) {
        const opIndex = "status".length;
        const opMatch = StatusFilter.filterSyntax[1].match(filter, opIndex)!;
        const op = filter.slice(opIndex, opMatch.consumed) as OperationKey;
        this.predicate = operations[op];

        const numberIndex = "status".length + opMatch.consumed;
        this.status = parseInt(filter.slice(numberIndex), 10);
    }

    static filterName = "Status";
    static filterDescription = "Match the status of the response";
    static filterSyntax = [
        new FixedStringSyntax("status"),
        new StringOptionsSyntax([
            "==",
            ">",
            ">=",
            "<",
            "<="
        ]),
        new FixedLengthNumberSyntax(3)
    ];

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.isSuccessfulExchange() &&
            this.predicate(event.response.statusCode, this.status);
    }

    toString() {
        return `Status = ${this.status}`;
    }
}

class CompletedFilter implements Filter {
    static filterName = "Completed";
    static filterDescription = "Match only completed requests";
    static filterSyntax = [new FixedStringSyntax("completed")]

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            event.isCompletedExchange();
    }

    toString() {
        return `Completed`;
    }
}

class PendingFilter implements Filter {
    static filterName = "Pending";
    static filterDescription = "Match only incomplete requests";
    static filterSyntax = [new FixedStringSyntax("pending")]

    matches(event: CollectedEvent): boolean {
        return event instanceof HttpExchange &&
            !event.isCompletedExchange();
    }

    toString() {
        return `Pending`;
    }
}

export const SelectableSearchFilterClasses: FilterClass[] = [
    StatusFilter,
    CompletedFilter,
    PendingFilter
];