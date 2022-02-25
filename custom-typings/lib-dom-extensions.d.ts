declare interface URLSearchParams {
    /** Make params iterable:  */
    [Symbol.iterator](): IterableIterator<[string, string]>;
    entries(): IterableIterator<[string, string]>;
}