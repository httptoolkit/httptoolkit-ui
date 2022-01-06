import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, autorun, runInAction, reaction } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';
import * as Randexp from 'randexp';

import { matchers } from "mockttp";

import { Headers } from '../../types';
import { css, styled } from '../../styles';
import { tryParseJson } from '../../util';

import { Matcher, MatcherClass, MatcherLookup, MatcherClassKey } from "../../model/rules/rules";

import { TextInput } from '../common/inputs';
import { EditablePairs, PairsArray } from '../common/editable-pairs';
import { EditableHeaders } from '../common/editable-headers';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

type MatcherConfigProps<M extends Matcher> = {
    matcher?: M;
    matcherIndex: number | undefined,
    onChange: (...matchers: Matcher[] & { 0?: M }) => void;
    onInvalidState: () => void;
};

abstract class MatcherConfig<M extends Matcher, P = {}> extends
    React.Component<MatcherConfigProps<M> & P> { }

export function MatcherConfiguration(props:
    ({ matcher: Matcher } | { matcherClass?: MatcherClass }) & {
        matcherIndex: number | undefined,
        onChange: (...matchers: Matcher[]) => void,
        onInvalidState?: () => void
    }
) {
    const { matcher } = props as { matcher?: Matcher };

    const matcherClass = 'matcher' in props
        ? MatcherLookup[props.matcher.type as MatcherClassKey]
        : props.matcherClass!;

    const configProps = {
        matcher: matcher as any,
        matcherIndex: props.matcherIndex,
        onChange: props.onChange,
        onInvalidState: props.onInvalidState || _.noop
    };

    switch (matcherClass) {
        case matchers.HostMatcher:
            return <HostMatcherConfig {...configProps} />;
        case matchers.SimplePathMatcher:
            return <SimplePathMatcherConfig {...configProps} />;
        case matchers.RegexPathMatcher:
            return <RegexPathMatcherConfig {...configProps} />;
        case matchers.QueryMatcher:
            return <QueryMatcherConfig {...configProps} />;
        case matchers.ExactQueryMatcher:
            return <ExactQueryMatcherConfig {...configProps} />;
        case matchers.HeaderMatcher:
            return <HeaderMatcherConfig {...configProps} />;
        case matchers.RawBodyMatcher:
            return <RawBodyExactMatcherConfig {...configProps} />;
        case matchers.RawBodyIncludesMatcher:
            return <RawBodyIncludesMatcherConfig {...configProps} />;
        case matchers.JsonBodyMatcher:
            return <JsonBodyExactMatcherConfig {...configProps} />;
        case matchers.JsonBodyFlexibleMatcher:
            return <JsonBodyIncludingMatcherConfig {...configProps} />;
        default:
            return null;
    }
}

const ConfigLabel = styled.label`
    margin: 5px 0;

    text-transform: uppercase;
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
`;

const MatcherConfigContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

@observer
class HostMatcherConfig extends MatcherConfig<matchers.HostMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private error: Error | undefined;

    @observable
    private host = '';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const host = this.props.matcher ? this.props.matcher.host : '';
            runInAction(() => { this.host = host });
        }));
    }

    render() {
        const { host } = this;
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer title={
            host
                ? `Matches all requests to ${
                    host
                }, regardless of their path or protocol`
                : undefined
        }>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } for host
                </ConfigLabel>
            }
            <TextInput
                id={this.fieldId}
                invalid={!!this.error}
                spellCheck={false}
                value={host}
                onChange={this.onChange}
                placeholder='A specific host to match: example.com'
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.host = event.target.value;

        try {
            this.props.onChange(new matchers.HostMatcher(this.host));
            this.error = undefined;
            event.target.setCustomValidity('');
        } catch (e) {
            console.log(e);

            this.error = e;
            this.props.onInvalidState();
            event.target.setCustomValidity(e.message);
        }
        event.target.reportValidity();
    }
}

@observer
class SimplePathMatcherConfig extends MatcherConfig<matchers.SimplePathMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private error: Error | undefined;

    @observable
    private url = '';

    componentDidMount() {
        // Avoid overriding state for new matchers, this lets us allow ? in the
        // string initially, and delay splitting into two matchers until later.
        if (this.props.matcherIndex === undefined) return;

        disposeOnUnmount(this, autorun(() => {
            const url = this.props.matcher ? this.props.matcher.path : '';

            runInAction(() => { this.url = url });
        }));
    }

    render() {
        const { url } = this;
        const { matcherIndex } = this.props;

        const urlMatch = (/(\w+:\/\/)?([^/?#]+)?(\/[^?#]*)?/.exec(url) || []);
        const [fullMatch, protocol, host, path] = urlMatch;

        return <MatcherConfigContainer title={
            (host || path)
                ? `Matches ${
                    protocol ? protocol.slice(0, -3) : 'any'
                } requests to ${
                    host ? `host ${host}` : 'any host'
                } at ${
                    path ? `path ${path}` : 'path /'
                }`
                : undefined
        }>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } for URL
                </ConfigLabel>
            }
            <TextInput
                id={this.fieldId}
                invalid={!!this.error}
                spellCheck={false}
                value={url}
                onChange={this.onChange}
                placeholder='A specific URL to match: http://example.com/abc'
            />
        </MatcherConfigContainer>;
    }

    ensurePathIsValid() {
        if (!this.url) throw new Error('The URL must not be empty');

        // If you start a URL with a protocol, it must be fully parseable:
        if (this.url.match(/\w+:\//)) {
            new URL(this.url);
        }

        // We leave the rest of the parsing to the SimplePathMatcher itself
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.url = event.target.value.split('#')[0];

        try {
            this.ensurePathIsValid();

            const [baseUrl, query] = this.url.split('?');

            if (query === undefined) {
                this.props.onChange(new matchers.SimplePathMatcher(baseUrl));
            } else {
                if (this.props.matcherIndex !== undefined) this.url = baseUrl;

                this.props.onChange(
                    new matchers.SimplePathMatcher(baseUrl),
                    new matchers.ExactQueryMatcher('?' + query)
                );
            }
            this.error = undefined;
            event.target.setCustomValidity('');
        } catch (e) {
            console.log(e);

            this.error = e;
            this.props.onInvalidState();
            event.target.setCustomValidity(e.message);
        }
        event.target.reportValidity();
    }
}

function unescapeRegexp(input: string): string {
    return input.replace(/\\\//g, '/');
}

const RegexInput = styled(TextInput)`
    font-family: ${p => p.theme.monoFontFamily};
`;

// A crazy (but fun) regex to spot literal ? characters in regular expression strings.
// Has some false (crazy) negatives but should have no false positives. Example false negative: [\]?]
// This is a big silly - if it ever breaks, fall back to using regjsparser instead (spot codepoint 63)
const containsLiteralQuestionMark = /([^\\]|^)\\(\?|u003F|x3F)|([^\\]|^)\[[^\]]*(\?|u003F|x3F)/;

@observer
class RegexPathMatcherConfig extends MatcherConfig<matchers.RegexPathMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private error: Error | undefined;

    @observable
    private pattern = '';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const pattern = this.props.matcher
                ? unescapeRegexp(this.props.matcher.regexSource)
                : '';

            runInAction(() => { this.pattern = pattern });
        }));
    }

    render() {
        const { matcherIndex } = this.props;

        let examples: string[] = [];
        let matchType: 'including' | 'that start with' | 'that end with' | 'like' = 'like';

        if (!this.error && this.props.matcher) {
            const { regexSource } = this.props.matcher;
            const regex = new RegExp(regexSource);
            const exp = new Randexp(regex);

            exp.defaultRange.subtract(32, 47); // Symbols
            exp.defaultRange.subtract(58, 64); // More symbols
            exp.defaultRange.subtract(123, 126); // Yet more symbols

            // For infinite ranges (.*), use up to 10 chars
            exp.max = 10;

            examples = _.uniq([exp.gen(), exp.gen(), exp.gen()])
                .filter((example) => example.length && example.match(regex))
                .sort();

            matchType =
                (regexSource.startsWith('^') && regexSource.endsWith('$'))
                    ? 'like'
                : regexSource.startsWith('^')
                    ? 'that start with'
                : regexSource.endsWith('$')
                    ? 'that end with'
                : 'including';
        }

        return <MatcherConfigContainer title={
                examples.length === 0
                    ? undefined
                : examples.length === 1
                    ? `Would match absolute URLs ${matchType} ${examples[0]}`
                : `Would match absolute URLs ${matchType}:\n\n${examples.join('\n')}`
            }>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } for URLs matching
                </ConfigLabel>
            }
            <RegexInput
                id={this.fieldId}
                invalid={!!this.error}
                spellCheck={false}
                value={this.pattern}
                onChange={this.onChange}
                placeholder='Any regular expression: https?://abc.com/.*'
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.pattern = event.target.value;

        try {
            if (!this.pattern) throw new Error('A pattern to match is required');
            if (this.pattern.match(containsLiteralQuestionMark)) {
                throw new Error(
                    'Query strings are matched separately, so a literal ? character will never match'
                );
            }
            this.props.onChange(
                new matchers.RegexPathMatcher(new RegExp(this.pattern))
            );
            this.error = undefined;
            event.target.setCustomValidity('');
        } catch (e) {
            console.log(e);

            this.error = e;
            this.props.onInvalidState();
            event.target.setCustomValidity(e.message);
        }
        event.target.reportValidity();
    }
}

type QueryObject = { [key: string]: string | string[] };

const queryObjectToPairsArray = (query: QueryObject): PairsArray =>
    _.flatMap(Object.entries(query), ([key, value]) => {
        if (_.isArray(value)) {
            return value.map((v) => ({ key, value: v }));
        } else {
            return { key, value };
        }
    });

const pairsArrayToQueryObject = (queryPairs: PairsArray): QueryObject =>
    _.mapValues(
        _.groupBy(queryPairs, ({ key }) => key),
        (pairs) =>
            pairs.length === 1
            ? pairs[0].value // Work around a Mockttp bug: 1-element arrays don't match single values
            : pairs.map(p => p.value)
    );

@observer
class QueryMatcherConfig extends MatcherConfig<matchers.QueryMatcher> {

    render() {
        const { matcherIndex, matcher } = this.props;

        const queryParams = queryObjectToPairsArray(matcher?.queryObject || {});

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } with query parameters including
                </ConfigLabel>
            }
            <EditablePairs
                pairs={queryParams}
                convertResult={pairsArrayToQueryObject}
                onChange={this.onChange}
                keyPlaceholder='Query parameter name'
                valuePlaceholder='Query parameter value'
                allowEmptyValues={true}
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(queryParams: QueryObject) {
        try {
            if (Object.keys(queryParams).some(key => !key)) {
                throw new Error("Invalid query parameter; query parameter names can't be empty");
            }

            if (Object.keys(queryParams).length === 0) {
                this.props.onChange();
            } else {
                this.props.onChange(new matchers.QueryMatcher(queryParams));
            }
        } catch (e) {
            console.log(e);
            this.props.onInvalidState();
        }
    }
}

@observer
class ExactQueryMatcherConfig extends MatcherConfig<matchers.ExactQueryMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private error: Error | undefined;

    @observable
    private query = '';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const query = this.props.matcher ? this.props.matcher.query : '';

            runInAction(() => { this.query = query });
        }));
    }

    render() {
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } with query
                </ConfigLabel>
            }
            <TextInput
                id={this.fieldId}
                invalid={!!this.error}
                spellCheck={false}
                value={this.query}
                onChange={this.onChange}
                placeholder='An exact query string to match, e.g. ?a=b'
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.query = event.target.value;

        try {
            this.props.onChange(new matchers.ExactQueryMatcher(this.query));
            this.error = undefined;
            event.target.setCustomValidity('');
        } catch (e) {
            console.log(e);

            this.error = e;
            this.props.onInvalidState();
            event.target.setCustomValidity(e.message);
        }
        event.target.reportValidity();
    }
}

type FlatHeaders = { [key: string]: string };

const headersToFlatHeaders = (headers: Headers): FlatHeaders =>
    _.mapValues(
        _.pickBy(headers, (key, value) => key && value),
        (value) =>
            _.isArray(value)
                ? value.join(', ')
                : value! // We know this is set because of filter above
    );


@observer
class HeaderMatcherConfig extends MatcherConfig<matchers.HeaderMatcher> {

    @observable
    private headers: Headers = {};

    componentDidMount() {
        disposeOnUnmount(this, reaction(
            () => this.props.matcher ? this.props.matcher.headers : {},
            (headers) => {
                if (!_.isEqual(headers, headersToFlatHeaders(this.headers))) {
                    this.headers = headers;
                }
            },
            { fireImmediately: true }
        ));
    }

    render() {
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } with headers including
                </ConfigLabel>
            }
            <EditableHeaders
                headers={this.headers}
                onChange={this.onChange}
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(headers: Headers) {
        this.headers = headers;

        try {
            if (Object.values(headers).some(value => !value)) {
                throw new Error("Invalid headers; header values can't be empty");
            }
            if (Object.keys(headers).some(key => !key)) {
                throw new Error("Invalid headers; header names can't be empty");
            }

            if (Object.keys(headers).length === 0) {
                this.props.onChange();
            } else {
                this.props.onChange(new matchers.HeaderMatcher(
                    // We convert here rather than using convertResult on EditableHeaders to ensure we
                    // preserve & nicely handle invalid input (like missing header values) that would
                    // is lost during flatHeader conversion.
                    headersToFlatHeaders(this.headers)
                ));
            }
        } catch (e) {
            console.log(e);
            this.props.onInvalidState();
        }
    }
}

const BodyContainer = styled.div<{ error?: boolean }>`
    > div {
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
        padding: 1px;

        ${p => p.error && css`
            border-color: ${p => p.theme.warningColor};
        `}
    }
`;

class RawBodyExactMatcherConfig extends MatcherConfig<matchers.RawBodyMatcher> {

    render() {
        return <RawBodyMatcherConfig
            {...this.props}
            matcherClass={matchers.RawBodyMatcher}
            description='with a decoded body exactly matching'
        />;
    }

}

class RawBodyIncludesMatcherConfig extends MatcherConfig<matchers.RawBodyIncludesMatcher> {

    render() {
        return <RawBodyMatcherConfig
            {...this.props}
            matcherClass={matchers.RawBodyIncludesMatcher}
            description='with a decoded body including'
        />;
    }

}

@observer
class RawBodyMatcherConfig<
    M extends (typeof matchers.RawBodyMatcher | typeof matchers.RawBodyIncludesMatcher)
> extends MatcherConfig<InstanceType<M>, {
    matcherClass: M,
    description: string
}> {

    @observable
    private content: string = '';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const content = this.props.matcher ? this.props.matcher.content : '';
            runInAction(() => { this.content = content });
        }));

        // Create the matcher immediately, so that this is already valid & addable,
        // if that's what you want to do.
        this.onBodyChange(this.content);
    }

    render() {
        const { content } = this;
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } { this.props.description }
                </ConfigLabel>
            }
            <BodyContainer>
                <ThemedSelfSizedEditor
                    value={content}
                    onChange={this.onBodyChange}
                    language='text'
                />
            </BodyContainer>
        </MatcherConfigContainer>;
    }

    @action.bound
    onBodyChange(content: string) {
        this.content = content;
        this.props.onChange(new this.props.matcherClass(content) as InstanceType<M>);
    }
}

class JsonBodyExactMatcherConfig extends MatcherConfig<matchers.JsonBodyMatcher> {

    render() {
        return <JsonMatcherConfig
            {...this.props}
            matcherClass={matchers.JsonBodyMatcher}
            description='with a JSON body equivalent to'
        />;
    }

}

class JsonBodyIncludingMatcherConfig extends MatcherConfig<matchers.JsonBodyFlexibleMatcher> {

    render() {
        return <JsonMatcherConfig
            {...this.props}
            matcherClass={matchers.JsonBodyFlexibleMatcher}
            description='with a JSON body including'
        />;
    }

}

@observer
class JsonMatcherConfig<
    M extends (typeof matchers.JsonBodyMatcher | typeof matchers.JsonBodyFlexibleMatcher)
> extends MatcherConfig<InstanceType<M>, {
    matcherClass: M,
    description: string
}> {

    @observable
    private content: string = this.props.matcher?.body
        ? JSON.stringify(this.props.matcher?.body, null, 2)
        : '{\n    \n}'; // Set up with a convenient open body initially

    @observable
    private error: Error | undefined;

    componentDidMount() {
        // When the matcher state changes (only that one direction) so that it's out of
        // sync with the shown content, update the content here to match.
        disposeOnUnmount(this, reaction(
            () => this.props.matcher?.body ?? {},
            (matcherContent) => {
                const parsedContent = tryParseJson(this.content);

                // If the matcher has changed and the content here either doesn't parse or
                // doesn't match the matcher, we override the shown content:
                if (parsedContent === undefined || !_.isEqual(parsedContent, matcherContent)) {
                    runInAction(() => {
                        this.content = JSON.stringify(matcherContent, null, 2);
                    });
                }
            }
        ));

        // Create the matcher immediately, so that this is already valid & addable,
        // if that's what you want to do.
        this.onBodyChange(this.content);
    }

    render() {
        const { content, error } = this;
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } { this.props.description }
                </ConfigLabel>
            }
            <BodyContainer error={!!error}>
                <ThemedSelfSizedEditor
                    value={content}
                    onChange={this.onBodyChange}
                    language='json'
                />
            </BodyContainer>
        </MatcherConfigContainer>;
    }

    @action.bound
    onBodyChange(content: string) {
        this.content = content;

        try {
            const parsedContent = JSON.parse(content);
            this.props.onChange(new this.props.matcherClass(parsedContent) as InstanceType<M>);
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = e;
            this.props.onInvalidState();
        }
    }
}
