import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { matchers } from 'mockttp';

import { styled, css } from '../../styles';
import { FontAwesomeIcon } from '../../icons';

import {
    HtkMockRule,
    Matcher,
    MatcherClass,
    MatcherKeys,
    MatcherLookup,
    MatcherClassKey,
    InitialMatcherClass,
    InitialMatcherClasses
} from '../../model/rules';
import {
    summarizeMatcherClass,
    summarizeMatcher,
    summarizeAction
} from '../../model/rules/rule-descriptions';

import { LittleCard } from '../common/card';
import { CloseButton } from '../common/close-button';
import { Button, interactiveMouseoverStyles } from '../common/inputs';
import { InitialMatcher } from '../../model/rules';
import { getMatcherConfigComponent } from './matcher-config';

interface RuleRowProps {
    rule: HtkMockRule;
}

const RowContainer = styled(LittleCard)`
    width: 100%;
    margin: 20px 0;

    svg {
        margin: 0 5px;
    }

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    font-size: ${p => p.theme.headingSize};

    ${(p: { collapsed: boolean }) => p.collapsed
        ? css`
            user-select: none;
        ` : css`
        `
    }
`;

export const AddRuleRow = styled((p: React.HTMLAttributes<HTMLDivElement>) =>
    <RowContainer collapsed={true} {...p}>
        <FontAwesomeIcon icon={['fas', 'plus']} />
        Add a new rule to rewrite requests or responses
    </RowContainer>
)`
    justify-content: center;
    background-color: ${p =>
        polished.rgba(p.theme.mainBackground, 0.4)
    };
    box-shadow: 0 0 4px 0 rgba(0,0,0,0.2);
`;

const MatcherOrAction = styled.section`
    align-self: stretch;
    flex-grow: 1;
    flex-basis: 0;
    max-width: calc(50% - 12px);
`;

const RuleMatcher = styled(MatcherOrAction)`
    text-align: left;
`

const RuleAction = styled(MatcherOrAction)`
    text-align: right;
`

const Summary = styled.h3`
    ${(p: { collapsed: boolean }) => !p.collapsed && css`
        opacity: 0.3;
    `}
`;

const Details = styled.div`
    margin-top: 20px;

    display: flex;
    flex-direction: column;
`;

const Select = styled.select`
    ${interactiveMouseoverStyles}

    font-size: ${p => p.theme.headingSize};
    font-family: ${p => p.theme.fontFamily};
`;

const MatchersList = styled.ul`
    margin: 10px;
    padding: 10px;
    border-left: 5px solid ${p => p.theme.containerBorder};
`;

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

const RulePart = styled.div`
    flex: 1 1 100%;
`;

const RuleButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 6px 10px;
    display: inline-block;
    margin-left: 5px;
`;

const getMatcherKey = (m: MatcherClass | Matcher | undefined) =>
    m === undefined
        ? ''
        : MatcherKeys.get(m as any) || MatcherKeys.get(m.constructor as any);
const getMatcherClassByKey = (k: MatcherClassKey) => MatcherLookup[k];

const InitialMatcherRow = (p: {
    matcher?: InitialMatcher,
    onChange: (m: InitialMatcher) => void
}) => {
    return <MatcherRow>
        <RulePart>
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
        </RulePart>
    </MatcherRow>
};

interface ExistingMatcherRowProps {
    matcher: matchers.RequestMatcher,
    onDelete: () => void
}

@observer
class ExistingMatcherRow extends React.Component<ExistingMatcherRowProps> {
    render() {
        const { matcher } = this.props;

        const MatcherConfiguration = getMatcherConfigComponent(
            matchers.MatcherLookup[matcher.type]
        );

        return <MatcherRow>
            <RulePart>
                <MatcherConfiguration />
            </RulePart>

            <RuleButton>
                <FontAwesomeIcon icon={['far', 'trash-alt']} />
            </RuleButton>
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

@observer
class NewMatcherRow extends React.Component<{
    onAdd: (matcher: matchers.RequestMatcher) => void
}> {

    @observable
    selectedMatcher: MatcherClass | undefined;

    @action.bound
    selectMatcher(event: React.ChangeEvent<HTMLSelectElement>) {
        const matcherKey = event.target.value as MatcherClassKey;
        this.selectedMatcher = MatcherLookup[matcherKey];
    }

    render() {
        const { selectedMatcher } = this;
        const MatcherConfiguration = getMatcherConfigComponent(this.selectedMatcher);

        return <MatcherRow>
            <RulePart>
                <Select
                    onChange={this.selectMatcher}
                    value={getMatcherKey(selectedMatcher)}
                >
                    <option value={''}>Add another matcher</option>

                    <MatcherOptions matchers={[
                        matchers.SimplePathMatcher,
                        matchers.RegexPathMatcher,
                        matchers.HeaderMatcher
                    ]} />
                </Select>

                <MatcherConfiguration />
            </RulePart>

            <RuleButton>
                <FontAwesomeIcon icon={['fas', 'plus']} />
            </RuleButton>
        </MatcherRow>;
    }
}

@observer
export class RuleRow extends React.Component<RuleRowProps> {

    @observable
    private collapsed: boolean = true;

    render() {
        const { rule } = this.props;

        return <RowContainer
            collapsed={this.collapsed}
            onClick={this.collapsed ? this.toggleCollapse : undefined}
        >
            <RuleMatcher>
                <Summary collapsed={this.collapsed}>
                    { summarizeMatcher(rule) }
                </Summary>

                {
                    !this.collapsed && <Details>
                        <div>Match:</div>

                        <MatchersList>
                            { rule.matchers.map((matcher, i) =>
                                i === 0
                                    // 1st matcher is always a method/wildcard matcher,
                                    // or undefined (handled below)
                                    ? <InitialMatcherRow
                                        key={i}
                                        matcher={matcher as InitialMatcher}
                                        onChange={this.setFirstMatcher}
                                    />
                                    : <ExistingMatcherRow
                                        key={i}
                                        matcher={matcher}
                                        onDelete={() => this.deleteMatcher(matcher)}
                                    />
                            )}

                            { rule.matchers.length === 0 &&
                                <InitialMatcherRow
                                    matcher={undefined}
                                    onChange={this.setFirstMatcher}
                                />
                            }

                            { rule.matchers.length > 0 &&
                                <NewMatcherRow onAdd={this.addMatcher} />
                            }
                        </MatchersList>
                    </Details>
                }
            </RuleMatcher>

            <FontAwesomeIcon icon={['fas', 'arrow-left']} rotation={180} />

            <RuleAction>
                <Summary collapsed={this.collapsed}>
                    { summarizeAction(rule) }
                </Summary>

                {
                    !this.collapsed && <Details>
                        Then { rule.handler.explain() }
                    </Details>
                }
            </RuleAction>

            { !this.collapsed &&
                <CloseButton onClose={this.toggleCollapse} />
            }
        </RowContainer>;
    }

    @action.bound
    addMatcher(matcher: matchers.RequestMatcher) {
        this.props.rule.matchers.push(matcher);
    }

    @action.bound
    setFirstMatcher(matcher: InitialMatcher) {
        this.props.rule.matchers[0] = matcher;
    }

    @action.bound
    deleteMatcher(matcher: matchers.RequestMatcher) {
        const { rule } = this.props;
        rule.matchers = rule.matchers.filter(m => m !== matcher);
    }

    @action.bound
    toggleCollapse() {
        this.collapsed = !this.collapsed;
    }
}