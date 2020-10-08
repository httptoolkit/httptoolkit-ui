import { CollectedEvent } from '../http/events-store';

import { SyntaxPart } from './syntax-parts';

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