import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import { Method, matchers } from 'mockttp';

import { styled, css } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { getMethodColor } from '../../model/exchange-colors';

import { HtkMockRule, Matcher, Handler, InitialMatcher } from '../../model/rules/rules';
import {
    summarizeMatcher,
    summarizeHandler
} from '../../model/rules/rule-descriptions';

import { LittleCard } from '../common/card';
import {
    InitialMatcherRow,
    ExistingMatcherRow,
    NewMatcherRow
} from './matcher-selection';
import { HandlerSelector } from './handler-selection';
import { HandlerConfiguration } from './handler-config';

interface RuleRowProps {
    rule: HtkMockRule;
    collapsed: boolean;
    toggleCollapse: () => void;
    deleteRule: () => void;
}

const RowContainer = styled<React.ComponentType<{
    collapsed: boolean,
    borderColor: string
} & React.HTMLAttributes<HTMLElement>>>(LittleCard)`
    width: 100%;
    margin: 20px 0;

    svg {
        margin: 0 5px;
    }

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    font-size: ${(p) => p.theme.headingSize};

    ${(p) => p.collapsed
        ? css`
            user-select: none;
        ` : css`
        `
    }

    border-left: 5px solid ${(p) => p.borderColor};
`;

export const AddRuleRow = styled((p: React.HTMLAttributes<HTMLDivElement>) =>
    <RowContainer collapsed={true} borderColor='transparent' {...p}>
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

const MatcherOrHandler = styled.section`
    align-self: stretch;
    flex-grow: 1;
    flex-basis: 0;
    max-width: calc(50% - 12px);
`;

const RuleMatcher = styled(MatcherOrHandler)`
    text-align: left;
`

const RuleHandler = styled(MatcherOrHandler)`
    text-align: right;
`

const Summary = styled.h3`
    ${(p: { collapsed: boolean }) => !p.collapsed && css`
        opacity: 0.3;
    `}

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    /* Required to avoid overflow trimming hanging chars */
    padding: 5px;
    margin: -5px;
`;

const Details = styled.div`
    margin-top: 20px;

    display: flex;
    flex-direction: column;
`;

const HandlerDetails = styled(Details)`
    padding-left: 20px;
    text-align: left;
`;

const MatchersList = styled.ul`
    margin: 10px;
    padding: 10px;
    border-left: 5px solid ${p => p.theme.containerWatermark};
`;


const MenuContainer = styled.div`
    position: absolute;
    top: 15px;
    right: 15px;

    display: flex;
    flex-direction: row;
    align-items: center;

    background-image: radial-gradient(
        ${p => polished.rgba(p.theme.mainBackground, 0.9)} 50%,
        transparent 100%
    );

    > svg {
        margin-left: 15px;
        padding: 5px;
        margin-top: -7px;
        margin-right: -5px;

        cursor: pointer;
        color: ${p => p.theme.primaryInputBackground};

        font-size: 1.2em;
    }
`;

const RuleMenu = (p: {
    onClose: () => void,
    onDelete: () => void,
}) => <MenuContainer>
    <FontAwesomeIcon icon={['far', 'trash-alt']} onClick={p.onDelete} />
    <FontAwesomeIcon icon={['fas', 'times']} onClick={p.onClose} />
</MenuContainer>

@observer
export class RuleRow extends React.Component<RuleRowProps> {

    render() {
        const { rule, collapsed, toggleCollapse } = this.props;

        const methodMatcher = rule.matchers[0];

        let method: string | undefined;
        if (methodMatcher instanceof matchers.MethodMatcher) {
            method = Method[methodMatcher.method];
        } else if (methodMatcher !== undefined) {
            method = 'unknown';
        } else {
            method = undefined;
        }

        return <RowContainer
            borderColor={method
                ? getMethodColor(method)
                : 'transparent'
            }
            collapsed={collapsed}
            onClick={collapsed ? toggleCollapse : undefined}
        >
            <RuleMatcher>
                <Summary collapsed={collapsed}>
                    { summarizeMatcher(rule) }
                </Summary>

                {
                    !collapsed && <Details>
                        <div>Match:</div>

                        <MatchersList>
                            { rule.matchers.map((matcher, i) =>
                                i === 0
                                    // 1st matcher is always a method/wildcard matcher,
                                    // or undefined (handled below)
                                    ? <InitialMatcherRow
                                        key={i}
                                        matcher={matcher as InitialMatcher}
                                        onChange={(m) => this.updateMatcher(i, m)}
                                    />
                                    : <ExistingMatcherRow
                                        key={i}
                                        matcher={matcher}
                                        onChange={(m) => this.updateMatcher(i, m)}
                                        onDelete={() => this.deleteMatcher(matcher)}
                                    />
                            )}

                            { rule.matchers.length === 0 &&
                                <InitialMatcherRow
                                    matcher={undefined}
                                    onChange={(m) => this.updateMatcher(0, m)}
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

            <RuleHandler>
                <Summary collapsed={collapsed}>
                    { summarizeHandler(rule) }
                </Summary>

                {
                    !collapsed && <HandlerDetails>
                        <div>Then:</div>
                        <HandlerSelector
                            value={rule.handler}
                            onChange={this.updateHandler}
                        />

                        <HandlerConfiguration
                            handler={rule.handler}
                            onChange={this.updateHandler}
                        />
                    </HandlerDetails>
                }
            </RuleHandler>

            { !collapsed &&
                <RuleMenu
                    onClose={toggleCollapse}
                    onDelete={this.props.deleteRule}
                />
            }
        </RowContainer>;
    }

    @action.bound
    addMatcher(matcher: Matcher) {
        this.props.rule.matchers.push(matcher);
    }

    @action.bound
    updateMatcher(index: number, matcher: Matcher) {
        this.props.rule.matchers[index] = matcher;
    }

    @action.bound
    deleteMatcher(matcher: Matcher) {
        const { rule } = this.props;
        rule.matchers = rule.matchers.filter(m => m !== matcher);
    }

    @action.bound
    updateHandler(handler: Handler) {
        this.props.rule.handler = handler;
    }
}