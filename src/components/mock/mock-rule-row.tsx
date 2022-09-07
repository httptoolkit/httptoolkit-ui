import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';
import { observer, inject, disposeOnUnmount, Observer } from 'mobx-react';
import { action, observable, reaction } from 'mobx';
import { Method, matchers } from 'mockttp';
import {
    Draggable,
    DraggingStyle,
    NotDraggingStyle,
    DraggableStateSnapshot
} from 'react-beautiful-dnd';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import { getMethodColor, getSummaryColour } from '../../model/events/categorization';
import {
    HtkMockRule,
    Matcher,
    Handler,
    isPaidHandler,
    InitialMatcher,
    getRuleTypeFromInitialMatcher,
    isCompatibleMatcher,
    isCompatibleHandler,
    getAvailableAdditionalMatchers,
    getAvailableHandlers,
    RuleType
} from '../../model/rules/rules';
import { ItemPath } from '../../model/rules/rules-structure';
import {
    summarizeMatcher,
    summarizeHandler
} from '../../model/rules/rule-descriptions';
import { AccountStore } from '../../model/account/account-store';
import {
    serverVersion as serverVersionObservable
} from '../../services/service-versions';

import { clickOnEnter, noPropagation } from '../component-utils';
import { GetProOverlay } from '../account/pro-placeholders';
import { LittleCard } from '../common/card';
import {
    InitialMatcherRow,
    ExistingMatcherRow,
    NewMatcherRow
} from './matcher-selection';
import { HandlerSelector } from './handler-selection';
import { HandlerConfiguration } from './handler-config';
import { DragHandle } from './mock-drag-handle';
import { IconMenu, IconMenuButton } from './mock-item-menu';

const RowContainer = styled(LittleCard)<{
    deactivated?: boolean,
    collapsed: boolean,
    disabled: boolean,
    borderColor: string,
    depth: number
}>`
    margin-top: 10px;

    width: calc(100% - ${p => p.depth * 40}px);
    margin-left: ${p => p.depth * 40}px;

    svg {
        margin: 0 5px;
    }

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    font-size: ${(p) => p.theme.headingSize};

    overflow: initial;

    ${(p) => p.collapsed && !p.disabled
        ? css`
            user-select: none;

            &:hover {
                ${IconMenu} {
                    display: flex;
                }

                ${DragHandle} {
                    opacity: 0.5;
                }
            }

            ${p.deactivated && 'opacity: 0.6;'}
        `
        : !p.collapsed
            ? css`
                ${IconMenu} {
                    display: flex;
                }
            `
        : ''
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
        depth={0}
        onClick={p.onAdd}
        onKeyPress={clickOnEnter}
    >
        <Icon icon={['fas', 'plus']} />
        Add a new rule to rewrite requests or responses
    </RowContainer>
)`
    margin-top: 20px;

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

const ArrowIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'arrow-left']
}))`
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

const RuleMenuContainer = styled(IconMenu)`
    background-image: radial-gradient(
        ${p => polished.rgba(p.theme.mainBackground, 0.9)} 50%,
        transparent 100%
    );
    z-index: 1;
`;

const RuleMenu = (p: {
    isCollapsed: boolean,
    isNewRule: boolean,
    hasUnsavedChanges: boolean,
    onToggleCollapse: (event: React.MouseEvent) => void,
    onSave: (event: React.MouseEvent) => void,
    onReset: (event: React.MouseEvent) => void,
    onClone: (event: React.MouseEvent) => void,
    toggleState: boolean,
    onToggleActivation: (event: React.MouseEvent) => void,
    onDelete: (event: React.MouseEvent) => void,
}) => <RuleMenuContainer topOffset={7}>
        <IconMenuButton
            title='Delete this rule'
            icon={['far', 'trash-alt']}
            onClick={p.onDelete}
        />
        <IconMenuButton
            title='Clone this rule'
            icon={['far', 'clone']}
            onClick={p.onClone}
        />
        <IconMenuButton
            title={p.toggleState ? 'Deactivate this rule' : 'Activate this rule'}
            icon={['fas', p.toggleState ? 'toggle-on' : 'toggle-off']}
            onClick={p.onToggleActivation}
        />
        <IconMenuButton
            title='Revert this rule to the last saved version'
            icon={['fas', 'undo']}
            disabled={!p.hasUnsavedChanges || p.isNewRule}
            onClick={p.onReset}
        />
        <IconMenuButton
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
    </RuleMenuContainer>;

const extendRowDraggableStyles = (
    style: DraggingStyle | NotDraggingStyle | undefined,
    snapshot: DraggableStateSnapshot
) => {
    const overrideStyles: _.Dictionary<string> = { };

    if (style && style.transition) {
        overrideStyles.transition = style.transition.replace(
            /transform [\d.]+s/,
            'transform 100ms'
        );
    }

    if (snapshot.combineWith && snapshot.combineWith.endsWith('-tail')) {
        overrideStyles.opacity = '1';
    }

    return {
        ...style,
        ...overrideStyles
    };
};

@inject('accountStore')
@observer
export class RuleRow extends React.Component<{
    accountStore?: AccountStore,

    index: number;
    path: ItemPath;
    rule: HtkMockRule;
    isNewRule: boolean;
    hasUnsavedChanges: boolean;
    collapsed: boolean;
    disabled: boolean;

    toggleRuleCollapsed: (ruleId: string) => void;

    saveRule: (path: ItemPath) => void;
    resetRule: (path: ItemPath) => void;
    deleteRule: (path: ItemPath) => void;
    cloneRule: (path: ItemPath) => void;

    getRuleDefaultHandler: (type: RuleType) => Handler;
}> {

    initialMatcherSelect = React.createRef<HTMLSelectElement>();
    containerRef: HTMLElement | null = null;

    @observable
    demoHandler: Handler | undefined;

    componentDidMount() {
        // If the actual handler ever changes, dump our demo handler state:
        disposeOnUnmount(this, reaction(
            () => this.props.rule.handler,
            () => { this.demoHandler = undefined; }
        ));
    }

    render() {
        const {
            index,
            rule,
            path,
            isNewRule,
            hasUnsavedChanges,
            collapsed,
            disabled
        } = this.props;
        const {
            isPaidUser,
            getPro
        } = this.props.accountStore!;

        const ruleType = rule.type;
        const initialMatcher = rule.matchers.length ? rule.matchers[0] : undefined;

        let ruleColour: string;
        if (ruleType === 'http') {
            if (initialMatcher instanceof matchers.MethodMatcher) {
                ruleColour = getMethodColor(Method[initialMatcher.method]);
            } else if (initialMatcher !== undefined) {
                ruleColour = getMethodColor('unknown');
            } else {
                ruleColour = 'transparent';
            }
        } else {
            ruleColour = getSummaryColour(ruleType);
        }

        const serverVersion = serverVersionObservable.state === 'fulfilled'
            ? serverVersionObservable.value as string
            : undefined;

        const availableMatchers = getAvailableAdditionalMatchers(ruleType, serverVersion);
        const availableHandlers = getAvailableHandlers(ruleType, serverVersion);

        // Handlers are in demo mode (uneditable, behind a 'Get Pro' overlay), either if the rule
        // has a handler you can't use, or you've picked a Pro handler and its been put in demoHandler
        const isHandlerDemo = !isPaidUser && (this.demoHandler || isPaidHandler(rule.handler));

        const ruleHandler = isHandlerDemo
            ? (this.demoHandler || rule.handler)
            : rule.handler

        return <Draggable
            draggableId={rule.id}
            index={index}
            isDragDisabled={!collapsed}
        >{ (provided, snapshot) => <Observer>{ () =>
            <RowContainer
                {...provided.draggableProps}
                borderColor={ruleColour}
                ref={(ref: HTMLElement | null) => {
                    provided.innerRef(ref);
                    this.containerRef = ref;
                }}
                collapsed={collapsed}
                deactivated={!rule.activated}
                disabled={disabled}
                tabIndex={collapsed ? 0 : undefined}
                onClick={collapsed ? this.toggleCollapse : undefined}
                onKeyPress={clickOnEnter}
                depth={path.length - 1}
                style={extendRowDraggableStyles(provided.draggableProps.style, snapshot)}
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
                    onClone={this.cloneRule}
                    onDelete={this.deleteRule}
                />
                <DragHandle {...provided.dragHandleProps} />

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
                                    onChange={this.setInitialMatcher}
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
                                        availableMatchers={availableMatchers}
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
                                availableHandlers={availableHandlers}
                            />

                            { isHandlerDemo
                                // If you select a paid handler with an unpaid account,
                                // show a handler demo with a 'Get Pro' overlay:
                                ? <GetProOverlay getPro={getPro} source={`rule-${ruleHandler.type}`}>
                                    <HandlerConfiguration
                                        ruleType={ruleType}
                                        handler={ruleHandler}
                                        onChange={_.noop}
                                    />
                                </GetProOverlay>
                                : <HandlerConfiguration
                                    ruleType={ruleType}
                                    handler={ruleHandler}
                                    onChange={this.updateHandler}
                                />
                            }
                        </Details>
                    }
                </MatcherOrHandler>
            </RowContainer>
        }</Observer>}</Draggable>;
    }

    saveRule = noPropagation(() => this.props.saveRule(this.props.path));
    resetRule = noPropagation(() => this.props.resetRule(this.props.path));
    deleteRule = noPropagation(() => this.props.deleteRule(this.props.path));
    cloneRule = noPropagation(() => this.props.cloneRule(this.props.path));

    @action.bound
    toggleActivation(event: React.MouseEvent) {
        const { rule } = this.props;
        rule.activated = !rule.activated;
        event.stopPropagation();
    }

    toggleCollapse = noPropagation(() => {
        // Scroll the row into view, after giving it a moment to rerender
        requestAnimationFrame(() => {
            if (this.containerRef) {
                this.containerRef.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
            if (this.initialMatcherSelect.current) {
                this.initialMatcherSelect.current.focus();
            }
        });

        this.props.toggleRuleCollapsed(this.props.rule.id);
    });

    @action.bound
    setInitialMatcher(matcher: InitialMatcher) {
        const currentRuleType = this.props.rule.type;
        const newRuleType = getRuleTypeFromInitialMatcher(matcher);

        if (currentRuleType === newRuleType) {
            this.props.rule.matchers[0] = matcher;
        } else {
            this.props.rule.type = newRuleType;

            this.props.rule.matchers = [
                matcher,
                // Drop any incompatible matchers:
                ...this.props.rule.matchers
                    .slice(1)
                    .filter(m => isCompatibleMatcher(m, newRuleType))
            ];

            // Reset the rule handler, if incompatible:
            this.props.rule.handler = isCompatibleHandler(this.props.rule.handler, newRuleType)
                ? this.props.rule.handler
                : this.props.getRuleDefaultHandler(newRuleType);
        }
    }

    @action.bound
    addMatcher(matcher: Matcher) {
        this.props.rule.matchers.push(
            matcher as any // Matcher must be valid, as availableMatchers is type-based
        );
    }

    @action.bound
    updateMatcher(index: number, ...matchers: Matcher[]) {
        this.props.rule.matchers.splice(index, 1,
            ...matchers as any[] // Matchers must be valid, as availableMatchers is type-based
        );
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