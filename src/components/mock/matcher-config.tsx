import * as _ from 'lodash';
import * as React from 'react';
import { matchers } from "mockttp";

import { Matcher, MatcherClass, MatcherLookup, MatcherClassKey } from "../../model/rules/rules";
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, autorun, runInAction } from 'mobx';
import { TextInput } from '../common/inputs';
import { styled } from '../../styles';

type MatcherConfigProps<M extends Matcher> = {
    matcher?: M;
    isExisting: boolean;
    onChange: (matcher: M, ...otherMatchers: Matcher[]) => void;
    onInvalidState: () => void;
};

abstract class MatcherConfig<M extends Matcher> extends React.Component<MatcherConfigProps<M>> { }


export function MatcherConfiguration(props:
    ({ matcher: Matcher } | { matcherClass?: MatcherClass }) & {
        isExisting: boolean,
        onChange: (matcher: Matcher, ...otherMatchers: Matcher[]) => void,
        onInvalidState?: () => void
    }
) {
    const { matcher } = props as { matcher?: Matcher };

    const matcherClass = 'matcher' in props
        ? MatcherLookup[props.matcher.type as MatcherClassKey]
        : props.matcherClass;

    const configProps = {
        matcher: matcher as any,
        isExisting: props.isExisting,
        onChange: props.onChange,
        onInvalidState: props.onInvalidState || _.noop
    };

    switch (matcherClass) {
        case matchers.SimplePathMatcher:
            return <SimplePathMatcherConfig {...configProps} />;
        case matchers.RegexPathMatcher:
            return <RegexPathMatcherConfig {...configProps} />;
        case matchers.ExactQueryMatcher:
            return <ExactQueryMatcherConfig {...configProps} />;
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
class SimplePathMatcherConfig extends MatcherConfig<matchers.SimplePathMatcher> {

    private fieldId = _.uniqueId();

    @observable
    private error: Error | undefined;

    @observable
    private path = '';

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const path = this.props.matcher ? this.props.matcher.path : '';

            runInAction(() => { this.path = path });
        }));
    }

    render() {
        return <MatcherConfigContainer>
            { this.props.isExisting &&
                <ConfigLabel htmlFor={this.fieldId}>
                    for URL
                </ConfigLabel>
            }
            <TextInput
                id={this.fieldId}
                invalid={!!this.error}
                spellCheck={false}
                value={this.path}
                onChange={this.onChange}
                placeholder='A specific URL to match'
            />
        </MatcherConfigContainer>;
    }

    ensurePathIsValid() {
        if (!this.path) throw new Error('Path is required');

        // If you start a URL with a protocol, it must be fully parseable:
        if (this.path.match(/\w+:\//)) {
            new URL(this.path);
        }

        // We leave the rest of the parsing to the SimplePathMatcher itself
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.path = event.target.value;

        try {
            this.ensurePathIsValid();

            const [path, query] = this.path.split('?');

            if (query === undefined) {
                this.props.onChange(new matchers.SimplePathMatcher(path));
            } else {
                if (this.props.isExisting) this.path = path;

                this.props.onChange(
                    new matchers.SimplePathMatcher(path),
                    new matchers.ExactQueryMatcher('?' + query)
                );
            }
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = e;
            this.props.onInvalidState();
        }
    }
}

function unescapeRegexp(input: string): string {
    return input.replace(/\\(.)/g, '$1');
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
        return <MatcherConfigContainer>
            { this.props.isExisting &&
                <ConfigLabel htmlFor={this.fieldId}>
                    for URLs matching
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
                throw new Error('Patterns will never match a literal ? character');
            }
            this.props.onChange(
                new matchers.RegexPathMatcher(new RegExp(this.pattern))
            );
            this.error = undefined;
        } catch (e) {
            console.log(e);
            this.error = e;
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
        return <MatcherConfigContainer>
            { this.props.isExisting &&
                <ConfigLabel htmlFor={this.fieldId}>
                    with query
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
        } catch (e) {
            console.log(e);
            this.error = e;
            this.props.onInvalidState();
        }
    }
}