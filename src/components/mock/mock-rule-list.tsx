import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import {
    SortableContainer
} from 'react-sortable-hoc';

import { styled } from '../../styles';

import { HtkMockRule, ruleEquality } from '../../model/rules/rules';

import { AddRuleRow, SortableRuleRow } from './mock-rule-row';

const MockRuleListContainer = styled.ol`
    padding: 0 40px 20px;
`;

export const MockRuleList = SortableContainer(observer(({ draftRules, ...props }: {
    draftRules: HtkMockRule[],
    activeRules: HtkMockRule[],

    addRule: () => void,
    saveRule: (id: string) => void,
    resetRule: (id: string) => void,
    deleteRule: (id: string) => void,

    toggleRuleCollapsed: (id: string) => void,

    collapsedRulesMap: { [id: string]: boolean },
    currentlyDraggingRuleIndex: number | undefined
}) => {
    // Draft has moved if its position in the real list (ignoring added/deleted rules) is the same
    // as its position in the draft list (ignoring added/deleted rules).
    const activeRulesIntersection = _.intersectionBy(props.activeRules, draftRules, r => r.id);
    const draftRulesIntersection = _.intersectionBy(draftRules, props.activeRules, r => r.id);

    return <MockRuleListContainer>
        <AddRuleRow
            onAdd={props.addRule}
            disabled={props.currentlyDraggingRuleIndex !== undefined}
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

            return <SortableRuleRow
                key={draftRule.id}
                index={i}

                rule={draftRule}

                isNewRule={activeIndex === -1}
                hasUnsavedChanges={hasUnsavedChanges}

                collapsed={isCollapsed}
                disabled={!isCollapsed}
                rowDisabled={
                    // When dragging, disable all rules
                    props.currentlyDraggingRuleIndex !== undefined &&
                    props.currentlyDraggingRuleIndex !== i
                }

                toggleCollapse={props.toggleRuleCollapsed}
                saveRule={props.saveRule}
                resetRule={props.resetRule}
                deleteRule={props.deleteRule}
            />
        }) }
    </MockRuleListContainer>
}));