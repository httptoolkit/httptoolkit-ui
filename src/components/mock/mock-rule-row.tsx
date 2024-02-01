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
import { UnreachableCheck } from '../../util/error';

import { getMethodColor, getSummaryColour } from '../../model/events/categorization';
import {
    HtkMockRule,
    Matcher,
    Handler,
    AvailableHandler,
    isPaidHandler,
    InitialMatcher,
    getRuleTypeFromInitialMatcher,
    isCompatibleHandler,
    getAvailableAdditionalMatchers,
    getAvailableHandlers,
    RuleType,
    HandlerStep,
    isFinalHandler,
    isStepPoweredRule,
    RulePriority,
    isHttpBasedRule
} from '../../model/rules/rules';
import { ItemPath } from '../../model/rules/rules-structure';
import {
    getRuleDefaultMatchers,
    updateRuleAfterInitialMatcherChange
} from '../../model/rules/rule-creation';
import {
    summarizeMatcher,
    summarizeHandler
} from '../../model/rules/rule-descriptions';
import { AccountStore } from '../../model/account/account-store';

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
import { RuleTitle, EditableRuleTitle } from './mock-rule-title';

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

    display: flex;
    flex-wrap: wrap;
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

                box-shadow: 0 2px 15px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha * 1.5});
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
    > svg {
        margin: 0 5px;
    }

    margin-top: 20px;

    justify-content: center;
    background-color: ${p =>
        polished.rgba(p.theme.mainBackground, 0.4)
    };
    box-shadow: 0 0 4px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
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
    display: flex;
    flex-direction: column;
    text-align: left;
`;

const DetailsHeader = styled.div`
    margin-top: 20px;
    margin-bottom: 20px;
`;

const HighPriorityMarker = styled(Icon).attrs(() => ({
    icon: ['fas', 'exclamation'],
    title: 'High-priority rule: this rule overrides all non-high-prority rules'
}))`
    margin-right: 10px;4
    align-self: baseline;
}
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
    isEditingTitle: boolean,
    onSetCustomTitle: (event: React.UIEvent) => void,
    onToggleCollapse: (event: React.UIEvent) => void,
    onSave: (event: React.UIEvent) => void,
    onReset: (event: React.UIEvent) => void,
    onClone: (event: React.UIEvent) => void,
    toggleState: boolean,
    onToggleActivation: (event: React.UIEvent) => void,
    onDelete: (event: React.UIEvent) => void,
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
            title='Give this rule a custom name'
            icon={['fas', 'edit']}
            disabled={p.isEditingTitle}
            onClick={p.onSetCustomTitle}
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
    private titleEditState: undefined | { originalTitle?: string };

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
        } else if (ruleType === 'websocket') {
            ruleColour = getSummaryColour('websocket');
        } else if (ruleType === 'ethereum') {
            ruleColour = getSummaryColour('mutative');
        } else if (ruleType === 'ipfs') {
            ruleColour = getSummaryColour('html');
        } else if (ruleType === 'webrtc') {
            ruleColour = getSummaryColour('rtc-data');
        } else {
            throw new UnreachableCheck(ruleType);
        }

        const availableMatchers = getAvailableAdditionalMatchers(ruleType);
        const availableHandlers = getAvailableHandlers(ruleType, initialMatcher);

        const ruleHandlers = 'handler' in rule
            ? [rule.handler]
            : rule.steps;

        // We show the summary by default, but if you set a custom title, we only show it when expanded:
        const shouldShowSummary = !collapsed || (!rule.title && !this.titleEditState);

        const isEditingTitle = !!this.titleEditState && !collapsed;
        const shouldShowCustomTitle = rule.title && !isEditingTitle;

        const priorityMarker = isHttpBasedRule(rule) && rule.priority && rule.priority > RulePriority.DEFAULT
            ? <HighPriorityMarker />
            : null;

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
                    isEditingTitle={isEditingTitle}
                    onSetCustomTitle={this.startEnteringCustomTitle}
                />
                <DragHandle {...provided.dragHandleProps} />


                { shouldShowCustomTitle &&
                    <RuleTitle>
                        { priorityMarker }
                        { rule.title }
                    </RuleTitle>
                }

                { isEditingTitle &&
                    <EditableRuleTitle
                        value={rule.title || ''}
                        onEditTitle={this.editTitle}
                        onSave={this.saveRule}
                        onCancel={
                            this.titleEditState!.originalTitle !== this.props.rule.title
                            ? this.cancelEditingTitle
                            : undefined
                        }
                    />
                }

                <MatcherOrHandler>
                    { shouldShowSummary &&
                        <Summary collapsed={collapsed} title={summarizeMatcher(rule)}>
                            { !shouldShowCustomTitle &&
                                // Same condition as the <RuleTitle> block above, because if a
                                // non-editable title is shown, the marker moves there instead.
                                priorityMarker
                            }
                            { summarizeMatcher(rule) }
                        </Summary>
                    }

                    {
                        !collapsed && <Details>
                            <DetailsHeader>Match:</DetailsHeader>

                            <ul>
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
                                        key={rule.type} // Reset when type changes
                                        availableMatchers={availableMatchers}
                                        existingMatchers={rule.matchers}
                                        onAdd={this.addMatcher}
                                    />
                                }
                            </ul>
                        </Details>
                    }
                </MatcherOrHandler>


                { shouldShowSummary &&
                    <ArrowIcon />
                }

                <MatcherOrHandler>
                    { shouldShowSummary &&
                        <Summary collapsed={collapsed} title={ summarizeHandler(rule) }>
                            { summarizeHandler(rule) }
                        </Summary>
                    }

                    {
                        !collapsed && <Details>
                            <DetailsHeader>Then:</DetailsHeader>

                            { ruleHandlers.map((ruleHandler, i) =>
                                <HandlerStepSection
                                    key={i}

                                    handler={ruleHandler}
                                    handlerIndex={i}

                                    isPaidUser={isPaidUser}
                                    getPro={getPro}
                                    ruleType={ruleType}
                                    availableHandlers={availableHandlers}
                                    updateHandler={this.updateHandler}
                                />
                            )}
                        </Details>
                    }
                </MatcherOrHandler>
            </RowContainer>
        }</Observer>}</Draggable>;
    }

    saveRule = noPropagation(() => {
        this.stopEditingTitle();
        this.props.saveRule(this.props.path);
    });
    resetRule = noPropagation(() => {
        this.stopEditingTitle();
        this.props.resetRule(this.props.path);
    });
    deleteRule = noPropagation(() => this.props.deleteRule(this.props.path));
    cloneRule = noPropagation(() => this.props.cloneRule(this.props.path));

    @action.bound
    toggleActivation(event: React.UIEvent) {
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
                // Clear selection too (sometimes clicking fast selects the rule title)
                getSelection()?.empty();
            }
        });

        this.props.toggleRuleCollapsed(this.props.rule.id);
        this.stopEditingTitle();
    });

    @action.bound
    setInitialMatcher(matcher: InitialMatcher) {
        const currentRuleType = this.props.rule.type;
        const newRuleType = getRuleTypeFromInitialMatcher(matcher);

        if (currentRuleType === newRuleType) {
            this.props.rule.matchers[0] = matcher;
        } else {
            this.props.rule.type = newRuleType;

            this.props.rule.matchers = getRuleDefaultMatchers(
                newRuleType,
                matcher,
                this.props.rule.matchers // Update from the old matchers
            ) as any[];
        }

        // Reset the rule handler/steps, if incompatible:
        const handlerResetRequired = 'handler' in this.props.rule
            ? !isCompatibleHandler(this.props.rule.handler, matcher)
            : !this.props.rule.steps.every(step => isCompatibleHandler(step, matcher));

        if (handlerResetRequired) {
            const newHandler = this.props.getRuleDefaultHandler(newRuleType);
            if (isStepPoweredRule(this.props.rule)) {
                (this.props.rule as { steps: HandlerStep[] }).steps = [newHandler as HandlerStep];
                delete (this.props.rule as any).handler;
            } else {
                (this.props.rule as { handler: Handler }).handler = newHandler;
                delete (this.props.rule as any).steps;
            }
        }

        updateRuleAfterInitialMatcherChange(this.props.rule);
    }

    @action.bound
    addMatcher(matcher: Matcher) {
        // TS struggles with complex union types here, so we cast more generally:
        const rule = this.props.rule as { matchers: Matcher[] };
        rule.matchers.push(matcher);
    }

    @action.bound
    updateMatcher(index: number, ...matchers: Matcher[]) {
        // TS struggles with complex union types here, so we cast more generally:
        const rule = this.props.rule as { matchers: Matcher[] };
        rule.matchers.splice(index, 1, ...matchers);
    }

    @action.bound
    deleteMatcher(matcher: Matcher) {
        // TS struggles with complex union types here, so we cast more generally:
        const rule = this.props.rule as { matchers: Matcher[] };
        rule.matchers = rule.matchers.filter(m => m !== matcher);
    }

    @action.bound
    updateHandler(handlerIndex: number, handler: Handler) {
        // TS struggles with complex union types here, so we cast more generally:
        const rule = this.props.rule as
            | { handler: Handler }
            | { steps: HandlerStep[] };

        if ('handler' in rule) {
            if (handlerIndex !== 0) throw new Error('Single-handler rules cannot have additional steps');
            rule.handler = handler;
        } else {
            rule.steps[handlerIndex] = handler as HandlerStep;

            if (isFinalHandler(handler)) {
                // If this is final, slice off anything after this step, it's all invalid
                rule.steps = rule.steps.slice(0, handlerIndex + 1);
            } else {
                // If at any point you change the last step to be a non-final step, we append a default
                // (must be final) step to allow continuing the rule:
                if (handlerIndex === rule.steps.length - 1) {
                    rule.steps.push(this.props.getRuleDefaultHandler(this.props.rule.type) as HandlerStep);
                }
            }
        }
    }

    @action.bound
    startEnteringCustomTitle(event: React.UIEvent) {
        this.titleEditState = { originalTitle: this.props.rule.title };
        // We expand the row, but not with toggleCollapsed, because we don't want
        // to auto-focus the matcher like normal:
        if (this.props.collapsed) this.props.toggleRuleCollapsed(this.props.rule.id);
        event.stopPropagation();
    }

    @action.bound
    editTitle(newTitle: string | undefined) {
        this.props.rule.title = newTitle || undefined;
    }

    @action.bound
    cancelEditingTitle() {
        if (!this.titleEditState) return;
        this.editTitle(this.titleEditState.originalTitle);
        this.titleEditState = undefined;
    }

    @action.bound
    stopEditingTitle() {
        if (!this.titleEditState) return;

        // Trim titles on save, so that e.g. space-only titles are dropped:
        if (this.props.rule.title !== this.titleEditState.originalTitle) {
            this.props.rule.title = this.props.rule.title?.trim() || undefined;
        }

        this.titleEditState = undefined;
    }

}

@observer
class HandlerStepSection extends React.Component<{
    isPaidUser: boolean;
    getPro: (source: string) => void;
    ruleType: RuleType;
    handlerIndex: number;
    handler: Handler;

    availableHandlers: AvailableHandler[];
    updateHandler: (handlerIndex: number, handler: Handler) => void;
}> {

    @observable
    private demoHandler: Handler | undefined;

    componentDidMount() {
        // If the actual handler ever changes, dump our demo handler state:
        disposeOnUnmount(this, reaction(
            () => this.props.handler,
            () => { this.demoHandler = undefined; }
        ));
    }

    render() {
        const {
            isPaidUser,
            getPro,
            ruleType,
            availableHandlers,
            handler
        } = this.props;

        const shownHandler = this.demoHandler ?? handler;

        const isHandlerDemo = !isPaidUser &&
            shownHandler &&
            isPaidHandler(ruleType, shownHandler);

        return <>
            <HandlerSelector
                value={shownHandler}
                ruleType={ruleType}
                onChange={this.updateHandler}
                availableHandlers={availableHandlers}
            />

            { isHandlerDemo
                // If you select a paid handler with an unpaid account,
                // show a handler demo with a 'Get Pro' overlay:
                ? <GetProOverlay getPro={getPro} source={`rule-${handler.type}`}>
                    <HandlerConfiguration
                        ruleType={ruleType}
                        handler={shownHandler}
                        onChange={_.noop}
                    />
                </GetProOverlay>
                : <HandlerConfiguration
                    ruleType={ruleType}
                    handler={shownHandler}
                    onChange={this.updateHandler}
                />
            }
        </>;
    }

    @action.bound
    updateHandler(handler: Handler) {
        const { isPaidUser, handlerIndex, ruleType, updateHandler } = this.props;

        // You can never update a paid handler if you're not a paid user
        if (!isPaidUser && isPaidHandler(ruleType, handler)) {
            this.demoHandler = handler;
        } else {
            updateHandler(handlerIndex, handler);
        }
    }

}