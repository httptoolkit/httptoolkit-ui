import * as _ from 'lodash';
import * as React from 'react';
import { matchers } from "mockttp";

import { Matcher, MatcherClass, MatcherLookup, MatcherClassKey } from "../../model/rules/rules";
import { SimplePathMatcher, RegexPathMatcher } from 'mockttp/dist/rules/matchers';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';
import { TextInput } from '../common/inputs';
import { styled } from '../../styles';

type MatcherConfigProps<M extends Matcher> = {
    matcher?: M;
    includeLabel: boolean;
    onChange: (matcher: M) => void;
    onInvalidState: () => void;
};

abstract class MatcherConfig<M extends Matcher> extends React.Component<MatcherConfigProps<M>> { }


export function MatcherConfiguration(props:
    ({ matcher: Matcher } | { matcherClass?: MatcherClass }) & {
        includeLabel: boolean,
        onChange: (matcher: Matcher) => void,
        onInvalidState?: () => void
    }
) {
    const { matcher } = props as { matcher?: Matcher };

    const matcherClass = 'matcher' in props
        ? MatcherLookup[props.matcher.type as MatcherClassKey]
        : props.matcherClass;

    const configProps = {
        matcher: matcher as any,
        includeLabel: props.includeLabel,
        onChange: props.onChange,
        onInvalidState: props.onInvalidState || _.noop
    };

    switch (matcherClass) {
        case SimplePathMatcher:
            return <SimplePathMatcherConfig {...configProps} />;
        case RegexPathMatcher:
            return <RegexPathMatcherConfig {...configProps} />;
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

const PathMatcherContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

@observer
class SimplePathMatcherConfig extends MatcherConfig<matchers.SimplePathMatcher> {

    private id = _.uniqueId();

    @observable
    private error: Error | undefined;

    // Only read once on creation: we trust the parent to set/reset a key prop
    // if this is going to change externally.
    @observable
    private path = this.props.matcher ? this.props.matcher.path : '';

    render() {
        return <PathMatcherContainer>
            { this.props.includeLabel &&
                <ConfigLabel htmlFor={this.id}>
                    for URL
                </ConfigLabel>
            }
            <TextInput
                id={this.id}
                invalid={!!this.error}
                spellCheck={false}
                value={this.path}
                onChange={this.onChange}
                placeholder='A specific URL to match'
            />
        </PathMatcherContainer>;
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

            this.props.onChange(new matchers.SimplePathMatcher(this.path));
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

@observer
class RegexPathMatcherConfig extends MatcherConfig<matchers.RegexPathMatcher> {

    @observable
    private error: Error | undefined;

    // Only read once on creation: we trust the parent to set/reset a key prop
    // if this is going to change externally.
    @observable
    private pattern = this.props.matcher
        ? unescapeRegexp(this.props.matcher.regexSource)
        : '';

    private id = _.uniqueId();

    render() {
        return <PathMatcherContainer>
            { this.props.includeLabel &&
                <ConfigLabel htmlFor={this.id}>
                    for URLs matching
                </ConfigLabel>
            }
            <RegexInput
                id={this.id}
                invalid={!!this.error}
                spellCheck={false}
                value={this.pattern}
                onChange={this.onChange}
                placeholder='Any regular expression: https?://abc.com/.*'
            />
        </PathMatcherContainer>;
    }

    @action.bound
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.pattern = event.target.value;

        try {
            if (!this.pattern) throw new Error('A pattern to match is required');
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