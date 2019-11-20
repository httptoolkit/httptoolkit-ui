import * as _ from 'lodash';
import * as React from 'react';
import { observer, Observer } from 'mobx-react'
import { Droppable, Draggable, DragDropContext, DragStart, DropResult } from 'react-beautiful-dnd';

import { styled } from '../../styles';

import { HtkMockRule, ruleEquality } from '../../model/rules/rules';

import { AddRuleRow, RuleRow } from './mock-rule-row';
import { observable, action } from 'mobx';

const MockRuleListContainer = styled.ol`
    padding: 0 40px 20px;
    min-height: calc(100% - 40px);
`;

@observer
export class MockRuleList extends React.Component<{
    draftRules: HtkMockRule[],
    activeRules: HtkMockRule[],

    addRule: () => void,
    saveRule: (id: string) => void,
    resetRule: (id: string) => void,
    deleteRule: (id: string) => void,
    moveRule: (startIndex: number, endIndex: number) => void,

    toggleRuleCollapsed: (id: string) => void,
    collapsedRulesMap: { [id: string]: boolean }
}> {

    @observable currentlyDraggingRuleId: string | undefined;

    @action.bound
    startDrag({ draggableId }: DragStart) {
        this.currentlyDraggingRuleId = draggableId;
    }

    @action.bound
    endDrag({ source, destination }: DropResult) {
        this.currentlyDraggingRuleId = undefined;
        if (!destination) return;
        this.props.moveRule(source.index, destination.index);
    }

    render() {
        const {
            draftRules,
            activeRules,

            addRule,
            saveRule,
            resetRule,
            deleteRule,

            toggleRuleCollapsed,
            collapsedRulesMap
        } = this.props;
        const {
            startDrag,
            endDrag,
            currentlyDraggingRuleId
        } = this;

        // Draft has moved if its position in the real list (ignoring added/deleted rules) is the same
        // as its position in the draft list (ignoring added/deleted rules).
        const activeRulesIntersection = _.intersectionBy(activeRules, draftRules, r => r.id);
        const draftRulesIntersection = _.intersectionBy(draftRules, activeRules, r => r.id);

        return <DragDropContext
            onDragStart={startDrag}
            onDragEnd={endDrag}
        >
            <Droppable droppableId='mock-rule-list'>{(provided) => <Observer>{() =>
                <MockRuleListContainer
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                >
                    <AddRuleRow
                        onAdd={addRule}
                        disabled={currentlyDraggingRuleId !== undefined}
                    />

                    { draftRules.map((draftRule, i) => {
                        const isCollapsed = collapsedRulesMap[draftRule.id];

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
                                currentlyDraggingRuleId !== undefined &&
                                currentlyDraggingRuleId !== draftRule.id
                            }

                            toggleCollapse={toggleRuleCollapsed}
                            saveRule={saveRule}
                            resetRule={resetRule}
                            deleteRule={deleteRule}
                        />
                    }) }

                    { provided.placeholder }
                </MockRuleListContainer>
            }</Observer>}</Droppable>
        </DragDropContext>
    };
}