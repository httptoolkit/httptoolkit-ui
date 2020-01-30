declare module 'chai-deep-match' {
    // Required to allow import * as ...
    namespace chaiDeepMatch { }

    function chaiDeepMatch(chai: any, utils: any): void;

    export = chaiDeepMatch;
}

declare namespace Chai {
    interface Deep {
        match(expected: any): Assertion;
    }
}