import * as _ from 'lodash';
import * as React from 'react';
import { observer, Observer } from 'mobx-react'
import { Droppable } from 'react-beautiful-dnd';

import { styled } from '../../styles';

import { HtkMockRule, ruleEquality } from '../../model/rules/rules';

import { AddRuleRow, RuleRow } from './mock-rule-row';

const MockRuleListContainer = styled.ol`
    padding: 0 40px 20px;
    min-height: calc(100% - 40px);
`;

export const MockRuleList = observer(({ draftRules, ...props }: {
    draftRules: HtkMockRule[],
    activeRules: HtkMockRule[],

    addRule: () => void,
    saveRule: (id: string) => void,
    resetRule: (id: string) => void,
    deleteRule: (id: string) => void,

    toggleRuleCollapsed: (id: string) => void,

    collapsedRulesMap: { [id: string]: boolean },
    currentlyDraggingRuleId: string | undefined
}) => {
    // Draft has moved if its position in the real list (ignoring added/deleted rules) is the same
    // as its position in the draft list (ignoring added/deleted rules).
    const activeRulesIntersection = _.intersectionBy(props.activeRules, draftRules, r => r.id);
    const draftRulesIntersection = _.intersectionBy(draftRules, props.activeRules, r => r.id);

    return <Droppable droppableId='mock-rule-list'>{(provided) => <Observer>{() =>
        <MockRuleListContainer
            ref={provided.innerRef}
            {...provided.droppableProps}
        >
            <AddRuleRow
                onAdd={props.addRule}
                disabled={props.currentlyDraggingRuleId !== undefined}
            />

            { draftRules.map((draftRule, i) => {
                const isCollapsed = props.collapsedRulesMap[draftRule.id];

                const draftIndex = draftRulesIntersection.indexOf(draftRule);
                const activeIndex = _.findIndex(activeRulesIntersection, { id: draftRule.id })
                const activeRule = activeRulesIntersection[activeIndex];
                const hasUnsavedChanges =
                    activeIndex === -1 || // New rule
                    draftIndex !== activeIndex || // Moved rule
                    !_.isEqualWith(activeRule, draftRule, ruleEquality); // Changed rule

                return <RuleRow
                    key={draftRule.id}
                    index={i}

                    rule={draftRule}

                    isNewRule={activeIndex === -1}
                    hasUnsavedChanges={hasUnsavedChanges}

                    collapsed={isCollapsed}
                    disabled={
                        // When dragging, disable all other rules
                        props.currentlyDraggingRuleId !== undefined &&
                        props.currentlyDraggingRuleId !== draftRule.id
                    }

                    toggleCollapse={props.toggleRuleCollapsed}
                    saveRule={props.saveRule}
                    resetRule={props.resetRule}
                    deleteRule={props.deleteRule}
                />
            }) }

            { provided.placeholder }
        </MockRuleListContainer>
    }</Observer>}</Droppable>
});