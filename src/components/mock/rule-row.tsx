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

import { clickOnEnter } from '../component-utils';
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
} & React.ComponentProps<'section'>>>(LittleCard)`
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

export const AddRuleRow = styled((p: {
    onAdd: () => void
} & React.HTMLAttributes<HTMLDivElement>) =>
    <RowContainer
        collapsed={true}
        borderColor='transparent'
        {..._.omit(p, 'onAdd')}

        tabIndex={0}
        onClick={p.onAdd}
        onKeyPress={clickOnEnter}
    >
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
    max-width: calc(50% - 30px);
`;

const Summary = styled.h1`
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

const ArrowIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'arrow-left']
})`
    transform: rotate(180deg);
    padding: 0 15px;
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
    z-index: 1;

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
    <FontAwesomeIcon icon={['far', 'trash-alt']} tabIndex={0} onKeyPress={clickOnEnter} onClick={p.onDelete} />
    <FontAwesomeIcon icon={['fas', 'times']} tabIndex={0} onKeyPress={clickOnEnter} onClick={p.onClose} />
</MenuContainer>

@observer
export class RuleRow extends React.Component<RuleRowProps> {

    initialMatcherSelect = React.createRef<HTMLSelectElement>();
    containerRef = React.createRef<HTMLElement>();

    render() {
        const { rule, collapsed } = this.props;

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
            ref={this.containerRef}
            collapsed={collapsed}
            tabIndex={collapsed ? 0 : undefined}
            onClick={collapsed ? this.toggleCollapse : undefined}
            onKeyPress={clickOnEnter}
        >
            { !collapsed &&
                <RuleMenu
                    onClose={this.toggleCollapse}
                    onDelete={this.props.deleteRule}
                />
            }

            <MatcherOrHandler>
                <Summary collapsed={collapsed}>
                    { summarizeMatcher(rule) }
                </Summary>

                {
                    !collapsed && <Details>
                        <div>Match:</div>

                        <MatchersList>
                            <InitialMatcherRow
                                ref={this.initialMatcherSelect}
                                matcher={rule.matchers.length ? rule.matchers[0] : undefined}
                                onChange={(m) => this.updateMatcher(0, m)}
                            />

                            { rule.matchers.slice(1).map((matcher, i) =>
                                <ExistingMatcherRow
                                    key={i}
                                    matcher={matcher}
                                    onChange={(m) => this.updateMatcher(i + 1, m)}
                                    onDelete={() => this.deleteMatcher(matcher)}
                                />
                            )}

                            { rule.matchers.length > 0 &&
                                <NewMatcherRow onAdd={this.addMatcher} />
                            }
                        </MatchersList>
                    </Details>
                }
            </MatcherOrHandler>

            <ArrowIcon />

            <MatcherOrHandler>
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
            </MatcherOrHandler>
        </RowContainer>;
    }

    toggleCollapse = () => {
        // Scroll the row into view, after giving it a moment to rerender
        requestAnimationFrame(() => {
            if (this.containerRef.current) {
                this.containerRef.current.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
            if (this.initialMatcherSelect.current) {
                this.initialMatcherSelect.current.focus();
            }
        });

        this.props.toggleCollapse();
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