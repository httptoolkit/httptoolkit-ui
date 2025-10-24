import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, autorun, runInAction, reaction, computed } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';
import * as Randexp from 'randexp';

import { matchers, Method, RawHeaders } from "mockttp";

import { css, styled } from '../../styles';

import { tryParseJson } from '../../util';
import { asError, UnreachableCheck } from '../../util/error';
import {
    FlatHeaders,
    headersToFlatHeaders,
    headersToRawHeaders,
    rawHeadersToHeaders
} from '../../model/http/headers';

import {
    Matcher,
    MatcherClass,
    MatcherClassKeyLookup,
    InitialMatcher,
    InitialMatcherKey,
    AdditionalMatcherKey,
    getRulePartKey,
    isHiddenMatcherKey
} from '../../model/rules/rules';
import { summarizeMatcherClass } from '../../model/rules/rule-descriptions';
import {
    WebSocketMethodMatcher
} from '../../model/rules/definitions/websocket-rule-definitions';
import {
    EthereumMethod,
    EthereumMethodMatcher,
    EthereumMethods,
    EthereumParamsMatcher
} from '../../model/rules/definitions/ethereum-rule-definitions';
import {
    IpfsInteraction,
    IpfsInteractionMatcher,
    IpfsArgMatcher,
    IpfsInteractions,
    IpfsArgDescription
} from '../../model/rules/definitions/ipfs-rule-definitions';
import {
    HasDataChannelMatcher,
    HasVideoTrackMatcher,
    HasAudioTrackMatcher,
    HasMediaTrackMatcher
} from '../../model/rules/definitions/rtc-rule-definitions';

import { Select, TextInput } from '../common/inputs';
import { EditablePairs, PairsArray } from '../common/editable-pairs';
import { EditableHeaders } from '../common/editable-headers';
import { SelfSizedEditor } from '../editor/base-editor';

type MatcherConfigProps<M extends Matcher> = {
    matcher?: M;
    matcherIndex: number | undefined,
    onChange: (...matchers: Matcher[] & { 0?: M }) => void;
    onInvalidState: () => void;
};

abstract class MatcherConfig<M extends Matcher, P = {}> extends
    React.Component<MatcherConfigProps<M> & P> { }

export function InitialMatcherConfiguration(props: {
        matcher?: InitialMatcher,
        onChange: (matcher: InitialMatcher) => void
    }
) {
    const { matcher } = props;

    // If no there's matcher class selected, we have no config to show:
    if (!matcher) return null;

    const matcherKey = getRulePartKey(matcher) as InitialMatcherKey;

    const configProps = {
        matcher: matcher as any,
        matcherIndex: 0,
        onChange: props.onChange,
        onInvalidState: _.noop
    };

    switch (matcherKey) {
        case 'eth-method':
            return <EthereumMethodMatcherConfig {...configProps} />;
        case 'ipfs-interaction':
            return <IpfsInteractionMatcherConfig {...configProps} />;
        // All the other initial matchers need no configuration:
        case 'wildcard':
        case 'ws-wildcard':
        case 'default-wildcard':
        case 'default-ws-wildcard':
        case 'rtc-wildcard':
        case 'GET':
        case 'POST':
        case 'PUT':
        case 'PATCH':
        case 'DELETE':
        case 'HEAD':
        case 'OPTIONS':
            return null;
        default:
            throw new UnreachableCheck(matcherKey);
    }
}

export function AdditionalMatcherConfiguration(props:
    ({ matcher: Matcher } | { matcherClass?: MatcherClass }) & {
        matcherIndex: number | undefined,
        onChange: (...matchers: Matcher[]) => void,
        onInvalidState?: () => void
    }
) {
    const { matcher } = props as { matcher?: Matcher };
    const { matcherClass } = props as { matcherClass?: MatcherClass };

    let matcherKey = ('matcher' in props
        ? getRulePartKey(props.matcher)
        : MatcherClassKeyLookup.get(props.matcherClass!)
    ) as AdditionalMatcherKey | undefined;

    // If no there's matcher class selected, we have no config to show:
    if (!matcherKey) return null;

    if (isHiddenMatcherKey(matcherKey)) {
        // This only happens, when we load a rule from elsewhere (defaults or file), and then
        // you try to configure it. Notably case: the am-i-using matcher.

        if (matcher && !isHiddenMatcherKey(matcher.type)) {
            // For special cases like these, we show and allow reconfiguring the rule as its non-hidden
            // base type, if there is one. I.e. we give some matchers a special display, which isn't selectable
            // but we allow modifying them as a normal selectable format if you want to mess around.
            matcherKey = matcher.type as AdditionalMatcherKey;
        } else {
            throw new Error(`Cannot configure hidden matcher type ${matcherKey}`);
        }
    }

    const configProps = {
        matcher: matcher as any,
        matcherIndex: props.matcherIndex,
        onChange: props.onChange,
        onInvalidState: props.onInvalidState || _.noop
    };

    switch (matcherKey) {
        case 'method':
            return <WsMethodMatcherConfig {...configProps} />;
        case 'host':
            return <HostMatcherConfig {...configProps} />;
        case 'simple-path':
            return <FlexiblePathMatcherConfig {...configProps} />;
        case 'regex-path':
            return <RegexPathMatcherConfig {...configProps} />;
        case 'query':
            return <QueryMatcherConfig {...configProps} />;
        case 'exact-query-string':
            return <ExactQueryMatcherConfig {...configProps} />;
        case 'header':
            return <HeaderMatcherConfig {...configProps} />;
        case 'raw-body':
            return <RawBodyExactMatcherConfig {...configProps} />;
        case 'raw-body-includes':
            return <RawBodyIncludesMatcherConfig {...configProps} />;
        case 'json-body':
            return <JsonBodyExactMatcherConfig {...configProps} />;
        case 'json-body-matching':
            return <JsonBodyIncludingMatcherConfig {...configProps} />;
        case 'eth-params':
            return <EthParamsMatcherConfig {...configProps} />;
        case 'ipfs-arg':
            return <IpfsArgMatcherConfig {...configProps} />;

        case 'has-rtc-data-channel':
        case 'has-rtc-video-track':
        case 'has-rtc-audio-track':
        case 'has-rtc-media-track':
            return <RTCContentMatcherConfig
                matcherKey={matcherKey}
                matcherClass={matcherClass as any} // Any because it must be the class for this key
                {...configProps}
            />;

        default:
            throw new UnreachableCheck(matcherKey);
    }
}

const ConfigLabel = styled.label`
    margin: 5px 0;

    text-transform: uppercase;
    font-family: ${p => p.theme.titleTextFamily};
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
`;

const MatcherConfigContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

@observer
class WsMethodMatcherConfig extends MatcherConfig<WebSocketMethodMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private method: Method = Method.GET;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const method = this.props.matcher?.method ?? Method.GET;
            runInAction(() => { this.method = method });
        }));

        // The matcher is valid by default, so immediately announce that (making the
        // add button enabled) if this is a new matcher that we're adding:
        if (!this.props.matcher) {
            this.props.onChange(new WebSocketMethodMatcher(this.method));
        }
    }

    render() {
        const { method } = this;
        const { matcherIndex } = this.props;

        const methodName = Method[method];

        // Extract the real numeric enum values from the TS enum:
        const methodValues = Object.values(Method).filter(n => !isNaN(Number(n))) as Method[];

        return <MatcherConfigContainer title={
            methodName
                ? `Matches all ${
                    methodName
                } requests`
                : undefined
        }>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } with method
                </ConfigLabel>
            }
            <Select
                id={this.fieldId}
                value={method}
                onChange={this.onChange}
            >
                { methodValues.map((method) =>
                    <option value={method} key={method}>
                        { Method[method] }
                    </option>
                )}
            </Select>
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLSelectElement>) {
        this.method = parseInt(event.currentTarget.value, 10);
        this.props.onChange(new WebSocketMethodMatcher(this.method));
    }
}

@observer
class EthereumMethodMatcherConfig extends React.Component<{
    matcher?: EthereumMethodMatcher;
    matcherIndex: number | undefined,
    onChange: (matcher: InitialMatcher) => void;
}> {

    private fieldId = _.uniqueId();

    @observable
    private method: EthereumMethod = 'eth_call';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const method = this.props.matcher?.methodName ?? 'eth_call';
            runInAction(() => { this.method = method });
        }));

        // The matcher is valid by default, so immediately announce that (making the
        // add button enabled) if this is a new matcher that we're adding:
        if (!this.props.matcher) {
            this.props.onChange(new EthereumMethodMatcher(this.method));
        }
    }

    render() {
        const { method } = this;

        return <MatcherConfigContainer title={
            `Match ${
                method
            } requests to Ethereum nodes`
        }>
            <ConfigLabel htmlFor={this.fieldId}>
                Requesting a node to
            </ConfigLabel>
            <Select
                id={this.fieldId}
                value={method}
                onChange={this.onChange}
            >
                { (Object.keys(EthereumMethods) as EthereumMethod[]).map((method) =>
                    <option value={method} key={method}>
                        { EthereumMethods[method] }
                    </option>
                )}
            </Select>
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLSelectElement>) {
        this.method = event.currentTarget.value as EthereumMethod;
        this.props.onChange(new EthereumMethodMatcher(this.method));
    }
}

@observer
class IpfsInteractionMatcherConfig extends React.Component<{
    matcher?: IpfsInteractionMatcher;
    matcherIndex: number | undefined,
    onChange: (matcher: InitialMatcher) => void;
}> {

    private fieldId = _.uniqueId();

    @observable
    private interaction: IpfsInteraction = 'cat';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const interaction = this.props.matcher?.interactionName ?? 'cat';
            runInAction(() => { this.interaction = interaction });
        }));

        // The matcher is valid by default, so immediately announce that (making the
        // add button enabled) if this is a new matcher that we're adding:
        if (!this.props.matcher) {
            this.props.onChange(new IpfsInteractionMatcher(this.interaction));
        }
    }

    render() {
        const { interaction } = this;

        return <MatcherConfigContainer title={
            `Match ${
                interaction
            } IPFS interactions`
        }>
            <ConfigLabel htmlFor={this.fieldId}>
                Requesting an IPFS node to
            </ConfigLabel>
            <Select
                id={this.fieldId}
                value={interaction}
                onChange={this.onChange}
            >
                { (Object.keys(IpfsInteractions) as IpfsInteraction[]).map((interaction) =>
                    <option value={interaction} key={interaction}>
                        { IpfsInteractions[interaction] }
                    </option>
                )}
            </Select>
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLSelectElement>) {
        this.interaction = event.currentTarget.value as IpfsInteraction;
        this.props.onChange(new IpfsInteractionMatcher(this.interaction));
    }
}

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

            this.error = asError(e);
            this.props.onInvalidState();
            event.target.setCustomValidity(this.error.message);
        }
        event.target.reportValidity();
    }
}

@observer
class FlexiblePathMatcherConfig extends MatcherConfig<matchers.FlexiblePathMatcher> {

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

        // We leave the rest of the parsing to the FlexiblePathMatcher itself
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.url = event.target.value.split('#')[0];

        try {
            this.ensurePathIsValid();

            const [baseUrl, query] = this.url.split('?');

            if (query === undefined) {
                this.props.onChange(new matchers.FlexiblePathMatcher(baseUrl));
            } else {
                if (this.props.matcherIndex !== undefined) this.url = baseUrl;

                this.props.onChange(
                    new matchers.FlexiblePathMatcher(baseUrl),
                    new matchers.ExactQueryMatcher('?' + query)
                );
            }
            this.error = undefined;
            event.target.setCustomValidity('');
        } catch (e) {
            console.log(e);

            this.error = asError(e);
            this.props.onInvalidState();
            event.target.setCustomValidity(this.error.message);
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

            this.error = asError(e);
            this.props.onInvalidState();
            event.target.setCustomValidity(this.error.message);
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

            this.error = asError(e);
            this.props.onInvalidState();
            event.target.setCustomValidity(this.error.message);
        }
        event.target.reportValidity();
    }
}

@observer
class HeaderMatcherConfig extends MatcherConfig<matchers.HeaderMatcher> {

    render() {
        const { matcherIndex } = this.props;

        const headers = this.props.matcher?.headers || {};

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } with headers including
                </ConfigLabel>
            }
            <EditableHeaders<FlatHeaders>
                headers={headers}
                convertToRawHeaders={this.convertInput}
                convertFromRawHeaders={this.convertResult}
                onChange={this.onChange}
                onInvalidState={this.props.onInvalidState}
            />
        </MatcherConfigContainer>;
    }

    convertInput(input: FlatHeaders) {
        return headersToRawHeaders(input);
    }

    convertResult(result: RawHeaders) {
        return headersToFlatHeaders(rawHeadersToHeaders(result));
    }

    @action.bound
    onChange(headers: FlatHeaders) {
        if (Object.keys(headers).length === 0) {
            this.props.onChange();
        } else {
            this.props.onChange(new matchers.HeaderMatcher(headers));
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
                <SelfSizedEditor
                    contentId={null}
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
                <SelfSizedEditor
                    contentId={null}
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
            this.error = asError(e);
            this.props.onInvalidState();
        }
    }
}

@observer
class IpfsArgMatcherConfig extends MatcherConfig<IpfsArgMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private arg: string | undefined;

    @computed get interaction(): IpfsInteraction {
        return this.props.matcher?.interaction || 'cat';
    }

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const arg = this.props.matcher?.argValue || undefined;
            runInAction(() => { this.arg = arg });
        }));
    }

    render() {
        const { matcherIndex } = this.props;

        const { placeholder, argType } = IpfsArgDescription[this.interaction]
            ?? { placeholder: '', argType: 'IPFS argument' };

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel htmlFor={this.fieldId}>
                    { matcherIndex !== 0 && 'and ' } for { argType }
                </ConfigLabel>
            }
            <TextInput
                id={this.fieldId}
                spellCheck={false}
                value={this.arg || ''}
                onChange={this.onChange}
                placeholder={placeholder}
            />
        </MatcherConfigContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.arg = event.target.value;
        this.props.onChange(new IpfsArgMatcher(this.interaction, this.arg));
    }
}

@observer
class EthParamsMatcherConfig extends MatcherConfig<EthereumParamsMatcher> {

    @observable
    private content: string = this.props.matcher?.params
        ? JSON.stringify(this.props.matcher?.params, null, 2)
        : '[\n    \n]'; // Set up with a convenient open array body initially

    @observable
    private error: Error | undefined;

    componentDidMount() {
        // When the matcher state changes (only that one direction) so that it's out of
        // sync with the shown content, update the content here to match.
        disposeOnUnmount(this, reaction(
            () => this.props.matcher?.params ?? {},
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
        this.onJsonChange(this.content);
    }

    render() {
        const { content, error } = this;
        const { matcherIndex } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } with Ethereum parameters matching
                </ConfigLabel>
            }
            <BodyContainer error={!!error}>
                <SelfSizedEditor
                    contentId={null}
                    value={content}
                    onChange={this.onJsonChange}
                    language='json'
                />
            </BodyContainer>
        </MatcherConfigContainer>;
    }

    @action.bound
    onJsonChange(content: string) {
        this.content = content;

        try {
            const parsedContent = JSON.parse(content);
            this.props.onChange(new EthereumParamsMatcher(parsedContent));
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = asError(e);
            this.props.onInvalidState();
        }
    }
}

@observer
class RTCContentMatcherConfig<T extends
    | typeof HasDataChannelMatcher
    | typeof HasVideoTrackMatcher
    | typeof HasAudioTrackMatcher
    | typeof HasMediaTrackMatcher
> extends MatcherConfig<InstanceType<T>, { matcherClass?: T, matcherKey: InstanceType<T>['type'] }> {

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const { matcher, matcherClass, onChange } = this.props;

            // Instantiate the matcher as-is, showing nothing.
            if (!matcher && matcherClass) onChange(new matcherClass() as InstanceType<T>);
        }));
    }

    render() {
        const { matcherIndex, matcherKey } = this.props;

        return <MatcherConfigContainer>
            { matcherIndex !== undefined &&
                <ConfigLabel>
                    { matcherIndex !== 0 && 'and ' } {
                        summarizeMatcherClass(matcherKey)
                    }
                </ConfigLabel>
            }
        </MatcherConfigContainer>;
    }
}