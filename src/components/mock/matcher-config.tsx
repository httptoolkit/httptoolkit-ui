import * as React from 'react';
import { matchers } from "mockttp";

import { MatcherClass } from "../../model/rules";

export const getMatcherConfigComponent = (matcherType: MatcherClass | undefined) => {
    switch (matcherType) {
        case matchers.SimplePathMatcher:
            return (p: { matcher?: matchers.SimplePathMatcher }) => <div>Simple</div>;
        case matchers.RegexPathMatcher:
            return (p: { matcher?: matchers.RegexPathMatcher }) => <div>Regex</div>;
        default:
            return () => null;
    }
}