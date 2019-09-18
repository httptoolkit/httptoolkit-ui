import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';
import { observer, inject } from 'mobx-react';
import { action, observable } from 'mobx';
import { SortableHandle, SortableElement } from 'react-sortable-hoc';
import { Method, matchers } from 'mockttp';

import { styled, css } from '../../styles';
import { FontAwesomeIcon, IconProp } from '../../icons';

import { getMethodColor } from '../../model/exchange-colors';
import { HtkMockRule, Matcher, Handler, isPaidHandler } from '../../model/rules/rules';
import {
    summarizeMatcher,
    summarizeHandler
} from '../../model/rules/rule-descriptions';
import { AccountStore } from '../../model/account/account-store';

import { clickOnEnter } from '../component-utils';
import { LittleCard } from '../common/card';
import {
    InitialMatcherRow,
    ExistingMatcherRow,
    NewMatcherRow
} from './matcher-selection';
import { HandlerSelector } from './handler-selection';
import { HandlerConfiguration } from './handler-config';
import { GetProOverlay } from '../account/pro-placeholders';

const FloatingDragHandle = styled.div`
    position: absolute;
    left: -36px;
    top: 14px;
    padding-right: 7px;

    cursor: row-resize;

    opacity: 0;

    :focus {
        outline: none;
        opacity: 0.5;
        color: ${p => p.theme.popColor};
    }
`;

const DragHandle = SortableHandle(() =>
    <FloatingDragHandle tabIndex={0}>
        <FontAwesomeIcon icon={['fas', 'grip-vertical']} />
    </FloatingDragHandle>
);


const RowContainer = styled<React.ComponentType<{
    deactivated?: boolean,
    collapsed: boolean,
    disabled: boolean,
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

    overflow: initial;

    ${(p) => p.collapsed
        ? css`
            user-select: none;

            &:hover {
                ${MenuContainer} {
                    display: flex;
                }

                ${FloatingDragHandle} {
                    opacity: 0.5;
                }
            }

            ${p.deactivated && 'opacity: 0.6;'}
        `
        : css`
            ${MenuContainer} {
                display: flex;
            }
        `
    }

    border-left: 5px solid ${(p) => p.borderColor};

    &:focus {
        outline: none;
        box-shadow: 0 0 1px 2px ${p =>
            polished.rgba(p.theme.popColor, 0.5)
        };
        background-color: ${p => p.theme.mainBackground};
    }
`;

export const AddRuleRow = styled((p: {
    onAdd: () => void,
    disabled: boolean
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
    text-align: left;
`;

const MatchersList = styled.ul`
    margin-top: 20px;
`;

const MenuContainer = styled.div`
    position: absolute;
    top: 7px;
    right: 10px;
    z-index: 1;

    display: none; /* Made flex by container, on hover/expand */
    flex-direction: row-reverse;
    align-items: center;

    background-image: radial-gradient(
        ${p => polished.rgba(p.theme.mainBackground, 0.9)} 50%,
        transparent 100%
    );
`;

const IconButton = styled(React.memo((p: {
    className?: string,
    icon: IconProp,
    title: string,
    onClick: (event: React.MouseEvent) => void,
    disabled?: boolean
}) => <FontAwesomeIcon
    className={p.className}
    icon={p.icon}
    title={p.title}
    tabIndex={p.disabled ? -1 : 0}
    onKeyPress={clickOnEnter}
    onClick={p.disabled ? _.noop : p.onClick}
/>))`
    margin: 0 0 0 10px;
    padding: 5px;

    font-size: 1.2em;

    ${p => p.disabled
        ? css`
            color: ${p => p.theme.containerWatermark};
        `
        : css`
            cursor: pointer;
            color: ${p => p.theme.primaryInputBackground};

            &:hover, &:focus {
                outline: none;
                color: ${p => p.theme.popColor};
            }
        `
    }
`;

const RuleMenu = (p: {
    isCollapsed: boolean,
    isNewRule: boolean,
    hasUnsavedChanges: boolean,
    onToggleCollapse: (event: React.MouseEvent) => void,
    onSave: (event: React.MouseEvent) => void,
    onReset: (event: React.MouseEvent) => void,
    toggleState: boolean,
    onToggleActivation: (event: React.MouseEvent) => void,
    onDelete: (event: React.MouseEvent) => void,
}) => <MenuContainer>
    <IconButton title='Delete this rule' icon={['far', 'trash-alt']} onClick={p.onDelete} />
    <IconButton
        title={p.toggleState ? 'Deactivate this rule' : 'Activate this rule'}
        icon={['fas', p.toggleState ? 'toggle-on' : 'toggle-off']}
        onClick={p.onToggleActivation}
    />
    <IconButton
        title='Revert this rule to the last saved version'
        icon={['fas', 'undo']}
        disabled={!p.hasUnsavedChanges || p.isNewRule}
        onClick={p.onReset}
    />
    <IconButton
        icon={['fas',
            p.hasUnsavedChanges
                ? 'save'
            : p.isCollapsed
                ? 'chevron-down'
            : 'chevron-up']}
        title={
            p.hasUnsavedChanges
                ? 'Save changes to this rule'
            : p.isCollapsed
                ? 'Show rule details'
            : 'Hide rule details'}
        onClick={p.hasUnsavedChanges ? p.onSave : p.onToggleCollapse}
    />
</MenuContainer>;

const stopPropagation = (callback: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    callback();
}

@inject('accountStore')
@observer
export class RuleRow extends React.Component<{
    accountStore?: AccountStore,

    rule: HtkMockRule;
    isNewRule: boolean;
    hasUnsavedChanges: boolean;
    collapsed: boolean;
    rowDisabled: boolean; // 'disabled' conflicts with sortable-hoc

    saveRule: (id: string) => void;
    resetRule: (id: string) => void;
    toggleCollapse: (id: string) => void;
    deleteRule: (id: string) => void;
}> {

    initialMatcherSelect = React.createRef<HTMLSelectElement>();
    containerRef = React.createRef<HTMLElement>();

    @observable
    demoHandler: Handler | undefined;

    render() {
        const { rule, isNewRule, hasUnsavedChanges, collapsed, rowDisabled } = this.props;
        const {
            isPaidUser,
            getPro
        } = this.props.accountStore!;

        const initialMatcher = rule.matchers.length ? rule.matchers[0] : undefined;

        let method: string | undefined;
        if (initialMatcher instanceof matchers.MethodMatcher) {
            method = Method[initialMatcher.method];
        } else if (initialMatcher !== undefined) {
            method = 'unknown';
        } else {
            method = undefined;
        }

        const ruleHandler = isPaidUser || !this.demoHandler
            ? rule.handler
            : this.demoHandler || rule.handler;

        return <RowContainer
            borderColor={method
                ? getMethodColor(method)
                : 'transparent'
            }
            ref={this.containerRef}
            collapsed={collapsed}
            deactivated={!rule.activated}
            disabled={rowDisabled}
            tabIndex={collapsed ? 0 : undefined}
            onClick={collapsed ? this.toggleCollapse : undefined}
            onKeyPress={clickOnEnter}
        >
            <RuleMenu
                isCollapsed={collapsed}
                isNewRule={isNewRule}
                hasUnsavedChanges={hasUnsavedChanges}
                onToggleCollapse={this.toggleCollapse}
                onSave={this.saveRule}
                onReset={this.resetRule}
                toggleState={rule.activated}
                onToggleActivation={this.toggleActivation}
                onDelete={this.deleteRule}
            />
            <DragHandle />

            <MatcherOrHandler>
                <Summary collapsed={collapsed} title={summarizeMatcher(rule)}>
                    { summarizeMatcher(rule) }
                </Summary>

                {
                    !collapsed && <Details>
                        <div>Match:</div>

                        <MatchersList>
                            <InitialMatcherRow
                                ref={this.initialMatcherSelect}
                                matcher={initialMatcher}
                                onChange={(...ms) => this.updateMatcher(0, ...ms)}
                            />

                            { rule.matchers.slice(1).map((matcher, i) =>
                                <ExistingMatcherRow
                                    key={`${i}/${rule.matchers.length}`}
                                    matcher={matcher}
                                    matcherIndex={i}
                                    onChange={(...ms) => this.updateMatcher(i + 1, ...ms)}
                                    onDelete={() => this.deleteMatcher(matcher)}
                                />
                            )}

                            { rule.matchers.length > 0 &&
                                <NewMatcherRow
                                    existingMatchers={rule.matchers}
                                    onAdd={this.addMatcher}
                                />
                            }
                        </MatchersList>
                    </Details>
                }
            </MatcherOrHandler>

            <ArrowIcon />

            <MatcherOrHandler>
                <Summary collapsed={collapsed} title={ summarizeHandler(rule) }>
                    { summarizeHandler(rule) }
                </Summary>

                {
                    !collapsed && <Details>
                        <div>Then:</div>
                        <HandlerSelector
                            value={ruleHandler}
                            onChange={this.updateHandler}
                        />

                        { ruleHandler === this.demoHandler
                            // If you select a paid handler with an unpaid account,
                            // show a handler demo with a 'Get Pro' overlay:
                            ? <GetProOverlay getPro={getPro}>
                                <HandlerConfiguration
                                    handler={this.demoHandler}
                                    onChange={_.noop}
                                />
                            </GetProOverlay>
                            : <HandlerConfiguration
                                handler={ruleHandler}
                                onChange={this.updateHandler}
                            />
                        }
                    </Details>
                }
            </MatcherOrHandler>
        </RowContainer>;
    }

    saveRule = stopPropagation(() => this.props.saveRule(this.props.rule.id));
    resetRule = stopPropagation(() => this.props.resetRule(this.props.rule.id));
    deleteRule = stopPropagation(() => this.props.deleteRule(this.props.rule.id));

    @action.bound
    toggleActivation(event: React.MouseEvent) {
        const { rule } = this.props;
        rule.activated = !rule.activated;
        event.stopPropagation();
    }

    toggleCollapse = stopPropagation(() => {
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

        this.props.toggleCollapse(this.props.rule.id);
    });

    @action.bound
    addMatcher(matcher: Matcher) {
        this.props.rule.matchers.push(matcher);
    }

    @action.bound
    updateMatcher(index: number, ...matchers: Matcher[]) {
        this.props.rule.matchers.splice(index, 1, ...matchers);
    }

    @action.bound
    deleteMatcher(matcher: Matcher) {
        const { rule } = this.props;
        rule.matchers = rule.matchers.filter(m => m !== matcher);
    }

    @action.bound
    updateHandler(handler: Handler) {
        const { isPaidUser } = this.props.accountStore!;

        if (isPaidUser || !isPaidHandler(handler)) {
            this.demoHandler = undefined;
            this.props.rule.handler = handler;
        } else {
            this.demoHandler = handler;
        }
    }
}

export const SortableRuleRow = SortableElement(RuleRow);