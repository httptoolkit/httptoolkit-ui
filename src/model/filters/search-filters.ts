import { CollectedEvent } from '../http/events-store';

export interface Filter {
    matches(event: CollectedEvent): boolean;
}

export class StringFilter implements Filter {
    constructor(
        public readonly filter: string
    ) {}

    matches(event: CollectedEvent): boolean {
        const filter = this.filter.toLocaleLowerCase();
        return event.searchIndex.includes(filter);
    }
}