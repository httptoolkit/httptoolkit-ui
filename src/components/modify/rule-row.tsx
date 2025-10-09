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

import { getMethodColor, getSummaryColor } from '../../model/events/categorization';
import {
    HtkRule,
    Matcher,
    Step,
    AvailableStep,
    isPaidStep,
    InitialMatcher,
    getRuleTypeFromInitialMatcher,
    isCompatibleStep,
    getAvailableAdditionalMatchers,
    getAvailableSteps,
    RuleType,
    isFinalStep,
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
    summarizeSteps
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
import { StepSelector } from './step-selection';
import { StepConfiguration } from './step-config';
import { DragHandle } from './rule-drag-handle';
import { IconMenu, IconMenuButton } from './rule-icon-menu';
import { RuleTitle, EditableRuleTitle } from './rule-title';

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
        role="button"

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
        margin: 0 10px;
    }

    margin-top: 20px;

    justify-content: center;
    background-color: ${p =>
        polished.rgba(p.theme.mainBackground, 0.4)
    };
    box-shadow: 0 0 4px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
`;

const MatcherOrSteps = styled.section`
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

const RightArrowIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'arrow-left']
}))`
    transform: rotate(180deg);
    padding: 0 10px;
    align-self: start;
}
`;

const NextStepArrowIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'arrow-left'],
    title: "Then..."
}))`
    margin: 10px auto;
    transform: rotate(270deg);
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
    title: 'High-priority rule: this rule overrides all non-high-priority rules'
}))`
    margin-right: 10px;
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
        <IconMenuButton
            title='Revert this rule to the last saved version'
            icon={['fas', 'undo']}
            disabled={!p.hasUnsavedChanges || p.isNewRule}
            onClick={p.onReset}
        />
        <IconMenuButton
            title='Give this rule a custom name'
            icon={['fas', 'edit']}
            disabled={p.isEditingTitle}
            onClick={p.onSetCustomTitle}
        />
        <IconMenuButton
            title={p.toggleState ? 'Deactivate this rule' : 'Activate this rule'}
            icon={['fas', p.toggleState ? 'toggle-on' : 'toggle-off']}
            onClick={p.onToggleActivation}
        />
        <IconMenuButton
            title='Clone this rule'
            icon={['far', 'clone']}
            onClick={p.onClone}
        />
        <IconMenuButton
            title='Delete this rule'
            icon={['far', 'trash-alt']}
            onClick={p.onDelete}
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
    rule: HtkRule;
    isNewRule: boolean;
    hasUnsavedChanges: boolean;
    collapsed: boolean;
    disabled: boolean;

    toggleRuleCollapsed: (ruleId: string) => void;

    saveRule: (path: ItemPath) => void;
    resetRule: (path: ItemPath) => void;
    deleteRule: (path: ItemPath) => void;
    cloneRule: (path: ItemPath) => void;

    getRuleDefaultStep: (type: RuleType) => Step;
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

        let ruleColor: string;
        if (ruleType === 'http') {
            if (initialMatcher instanceof matchers.MethodMatcher) {
                ruleColor = getMethodColor(Method[initialMatcher.method]);
            } else if (initialMatcher !== undefined) {
                ruleColor = getMethodColor('unknown');
            } else {
                ruleColor = 'transparent';
            }
        } else if (ruleType === 'websocket') {
            ruleColor = getSummaryColor('websocket');
        } else if (ruleType === 'ethereum') {
            ruleColor = getSummaryColor('mutative');
        } else if (ruleType === 'ipfs') {
            ruleColor = getSummaryColor('html');
        } else if (ruleType === 'webrtc') {
            ruleColor = getSummaryColor('rtc-data');
        } else {
            throw new UnreachableCheck(ruleType);
        }

        const availableMatchers = getAvailableAdditionalMatchers(ruleType);
        const availableSteps = getAvailableSteps(ruleType, initialMatcher);

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
                borderColor={ruleColor}
                ref={(ref: HTMLElement | null) => {
                    provided.innerRef(ref);
                    this.containerRef = ref;
                }}
                aria-expanded={!collapsed}
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
                <DragHandle
                    aria-label={`Drag handle for ${
                        (shouldShowCustomTitle || isEditingTitle) && rule.title
                            ? `this '${rule.title}'`
                            : 'this'
                    } mock rule`}
                    {...provided.dragHandleProps}
                />


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

                <MatcherOrSteps>
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
                </MatcherOrSteps>


                { shouldShowSummary &&
                    <RightArrowIcon />
                }

                <MatcherOrSteps>
                    { shouldShowSummary &&
                        <Summary collapsed={collapsed} title={ summarizeSteps(rule) }>
                            { summarizeSteps(rule) }
                        </Summary>
                    }

                    {
                        !collapsed && <Details>
                            <DetailsHeader>Then:</DetailsHeader>

                            { rule.steps.map((step, i) => <>
                                { i > 0 &&
                                    <NextStepArrowIcon key={`then-${i}`} />
                                }
                                <StepSection
                                    key={i}

                                    step={step}
                                    stepIndex={i}

                                    isPaidUser={isPaidUser}
                                    getPro={getPro}
                                    ruleType={ruleType}
                                    availableSteps={availableSteps}
                                    updateStep={this.updateStep}
                                />
                            </>)}
                        </Details>
                    }
                </MatcherOrSteps>
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

        // Reset the rule steps, if incompatible:
        const stepResetRequired = !(this.props.rule.steps as Step[]).every(step => isCompatibleStep(step, matcher));

        if (stepResetRequired) {
            const newStep = this.props.getRuleDefaultStep(newRuleType);
            (this.props.rule as { steps: Step[] }).steps = [newStep as Step];
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
    updateStep(stepIndex: number, step: Step) {
        // TS struggles with complex union types here, so we cast more generally:
        const rule = this.props.rule as { steps: Step[] };

        rule.steps[stepIndex] = step;

        if (isFinalStep(step)) {
            // If this is final, slice off anything after this step, it's all invalid
            rule.steps = rule.steps.slice(0, stepIndex + 1);
        } else {
            // If at any point you change the last step to be a non-final step, we append a default
            // (must be final) step to allow continuing the rule:
            if (stepIndex === rule.steps.length - 1) {
                rule.steps.push(this.props.getRuleDefaultStep(this.props.rule.type));
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
class StepSection extends React.Component<{
    isPaidUser: boolean;
    getPro: (source: string) => void;
    ruleType: RuleType;
    stepIndex: number;
    step: Step;

    availableSteps: AvailableStep[];
    updateStep: (stepIndex: number, step: Step) => void;
}> {

    @observable
    private demoStep: Step | undefined;

    componentDidMount() {
        // If the actual step ever changes, dump our demo step state:
        disposeOnUnmount(this, reaction(
            () => this.props.step,
            () => { this.demoStep = undefined; }
        ));
    }

    render() {
        const {
            isPaidUser,
            getPro,
            ruleType,
            availableSteps,
            step: step,
            stepIndex: stepIndex
        } = this.props;

        const shownStep = this.demoStep ?? step;

        const isStepDemo = !isPaidUser &&
            shownStep &&
            isPaidStep(ruleType, shownStep);

        return <>
            <StepSelector
                value={shownStep}
                ruleType={ruleType}
                onChange={this.updateStep}
                availableSteps={availableSteps}
                stepIndex={stepIndex}
            />

            { isStepDemo
                // If you select a paid step with an unpaid account,
                // show a step demo with a 'Get Pro' overlay:
                ? <GetProOverlay getPro={getPro} source={`rule-${step.type}`}>
                    <StepConfiguration
                        ruleType={ruleType}
                        step={shownStep}
                        onChange={_.noop}
                    />
                </GetProOverlay>
                : <StepConfiguration
                    ruleType={ruleType}
                    step={shownStep}
                    onChange={this.updateStep}
                />
            }
        </>;
    }

    @action.bound
    updateStep(step: Step) {
        const { isPaidUser, stepIndex: stepIndex, ruleType, updateStep } = this.props;

        // You can never update a paid step if you're not a paid user
        if (!isPaidUser && isPaidStep(ruleType, step)) {
            this.demoStep = step;
        } else {
            updateStep(stepIndex, step);
        }
    }

}