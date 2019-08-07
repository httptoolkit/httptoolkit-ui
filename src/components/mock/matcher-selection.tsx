import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { action, observable } from 'mobx';

import { matchers } from 'mockttp';

import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { interactiveMouseoverStyles, Button } from '../common/inputs';

import {
    Matcher,
    MatcherClass,
    MatcherKeys,
    MatcherLookup,
    MatcherClassKey,
    InitialMatcher,
    InitialMatcherClass,
    InitialMatcherClasses
} from '../../model/rules';
import {
    summarizeMatcherClass
} from '../../model/rules/rule-descriptions';

import { MatcherConfiguration } from './matcher-config';

const getMatcherKey = (m: MatcherClass | Matcher | undefined) =>
    m === undefined
        ? ''
        : MatcherKeys.get(m as any) || MatcherKeys.get(m.constructor as any);
const getMatcherClassByKey = (k: MatcherClassKey) => MatcherLookup[k];

const MatcherRow = styled.li`
    display: flex;
    flex-direction: row;
    margin: 5px 0;

    &:first-child {
        margin-top: 0;
    }

    &:last-child {
        margin-bottom: 0;
    }
`;

const Select = styled.select`
    ${interactiveMouseoverStyles}

    font-size: ${p => p.theme.headingSize};
    font-family: ${p => p.theme.fontFamily};

    width: 100%;
    border-radius: 4px;
`;

const MatcherInputsContainer = styled.div`
    flex: 1 1 100%;
`;

const MatcherButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 6px 10px;
    display: inline-block;
    margin-left: 5px;
`;

export const InitialMatcherRow = (p: {
    matcher?: InitialMatcher,
    onChange: (m: InitialMatcher) => void
}) => {
    return <MatcherRow>
        <MatcherInputsContainer>
            <Select
                value={getMatcherKey(p.matcher)}
                onChange={(event) => {
                    const value = event.currentTarget.value as MatcherClassKey | undefined;
                    if (value) {
                        const MatcherCls = getMatcherClassByKey(value) as InitialMatcherClass;
                        p.onChange(new MatcherCls());
                    }
                }}
            >
                <MatcherOptions matchers={InitialMatcherClasses} />

                { p.matcher === undefined &&
                    <option value={''}>
                        Never
                    </option>
                }
            </Select>
        </MatcherInputsContainer>
    </MatcherRow>
};

interface ExistingMatcherRowProps {
    matcher: Matcher;
    onDelete: () => void;
    onChange: (m: Matcher) => void;
}

@observer
export class ExistingMatcherRow extends React.Component<ExistingMatcherRowProps> {
    render() {
        const { matcher, onChange, onDelete } = this.props;

        return <MatcherRow>
            <MatcherInputsContainer>
                <MatcherConfiguration
                    matcher={matcher}
                    onChange={onChange}
                />
            </MatcherInputsContainer>

            <MatcherButton onClick={onDelete}>
                <FontAwesomeIcon icon={['far', 'trash-alt']} />
            </MatcherButton>
        </MatcherRow>;
    }
}


const MatcherOptions = (p: { matchers: Array<MatcherClass> }) => <>{
    p.matchers.map((matcher): JSX.Element | null => {
        const key = getMatcherKey(matcher);
        const description = summarizeMatcherClass(matcher);

        return description
            ? <option key={key} value={key}>{
                description
            }</option>
            : null;
    })
}</>

const NewMatcherConfigContainer = styled.form`
    :not(:empty) {
        margin-top: 5px;
    }
`;

@observer
export class NewMatcherRow extends React.Component<{
    onAdd: (matcher: Matcher) => void
}> {

    @observable
    matcherClass: MatcherClass | undefined;

    @observable
    draftMatcher: Matcher | undefined;

    @observable
    invalidMatcherState = false;

    private dropdownRef = React.createRef<HTMLSelectElement>();

    @action.bound
    selectMatcher(event: React.ChangeEvent<HTMLSelectElement>) {
        const matcherKey = event.target.value as MatcherClassKey;
        this.matcherClass = MatcherLookup[matcherKey];
        this.updateDraftMatcher(undefined);
    }

    @action.bound
    updateDraftMatcher(matcher: Matcher | undefined) {
        this.draftMatcher = matcher;
        this.invalidMatcherState = false;
    }

    @action.bound
    markMatcherInvalid() {
        this.invalidMatcherState = true;
    }

    @action.bound
    saveMatcher(e?: React.FormEvent) {
        if (e) e.preventDefault();

        if (!this.draftMatcher) return;
        this.props.onAdd(this.draftMatcher);

        this.matcherClass = undefined;
        this.draftMatcher = undefined;
        this.invalidMatcherState = false;

        // Reset the focus ready to add another element
        const dropdown = this.dropdownRef.current;
        if (dropdown) dropdown.focus();
    }

    render() {
        const {
            matcherClass,
            draftMatcher,
            updateDraftMatcher,
            invalidMatcherState,
            markMatcherInvalid,
            saveMatcher
        } = this;

        return <MatcherRow>
            <MatcherInputsContainer>
                <Select
                    onChange={this.selectMatcher}
                    value={getMatcherKey(matcherClass)}
                    ref={this.dropdownRef}
                >
                    <option value={''}>Add another matcher:</option>

                    <MatcherOptions matchers={[
                        matchers.SimplePathMatcher,
                        matchers.RegexPathMatcher
                    ]} />
                </Select>

                <NewMatcherConfigContainer onSubmit={
                    !invalidMatcherState && draftMatcher
                        ? saveMatcher
                        : (e) => e.preventDefault()
                }>
                    { draftMatcher
                        ? <MatcherConfiguration
                            matcher={draftMatcher}
                            onChange={updateDraftMatcher}
                            onInvalidState={markMatcherInvalid}
                        />
                        : <MatcherConfiguration
                            matcherClass={matcherClass}
                            onChange={updateDraftMatcher}
                            onInvalidState={markMatcherInvalid}
                        />
                    }
                </NewMatcherConfigContainer>
            </MatcherInputsContainer>

            <MatcherButton
                disabled={!draftMatcher || invalidMatcherState}
                onClick={saveMatcher}
            >
                <FontAwesomeIcon icon={['fas', 'plus']} />
            </MatcherButton>
        </MatcherRow>;
    }
}