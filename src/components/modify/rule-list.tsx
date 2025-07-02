import * as _ from 'lodash';
import * as React from 'react';
import { observable, action } from 'mobx';
import { observer, Observer } from 'mobx-react'
import { Droppable, DragDropContext, BeforeCapture, DropResult } from 'react-beautiful-dnd';

import { styled } from '../../styles';

import {
    areItemsEqual,
    HtkRuleGroup,
    ItemPath,
    findItemPath,
    HtkRuleRoot,
    getItemParentByPath,
    isRuleGroup,
    comparePaths,
    getItemAtPath,
    findItem,
} from '../../model/rules/rules-structure';
import { Step, HtkRule, RuleType } from '../../model/rules/rules';

import { GroupHeader, GroupTail } from './rule-group';
import { AddRuleRow, RuleRow } from './rule-row';

const RuleListContainer = styled.ol`
    padding: 0 40px 20px;
    min-height: calc(100% - 40px);
`;

function getDragTarget(
    indexMapping: Array<ItemPath>,
    rules: HtkRuleRoot,
    sourceIndex: number,
    destinationIndex: number
) {
    const sourcePath = indexMapping[sourceIndex];
    const displacedItemPath = indexMapping[destinationIndex];

    const pathComparison = comparePaths(sourcePath, displacedItemPath);

    const displacedItemParent = getItemParentByPath(rules, displacedItemPath);
    const displacedItemIndex = _.last(displacedItemPath)!;

    // Avoid reading off the end of the children (for group tail elements),
    // to stop mobx complaining at us.
    const displacedItem = displacedItemParent.items.length > displacedItemIndex
        ? getItemAtPath(rules, displacedItemPath)
        : undefined;

    const sourceParentPath = sourcePath.slice(0, -1);
    const targetParentPath = displacedItemPath.slice(0, -1);

    if (
        displacedItem &&
        isRuleGroup(displacedItem) &&
        !displacedItem.collapsed &&
        pathComparison > 0
    ) {
        // If you displace an expanded group header below you from above, then
        // you're actually entering the top of the group
        return { sourcePath, targetPath: displacedItemPath.concat(0) };
    }

    if (displacedItem === undefined && pathComparison > 0) {
        // If you displace the empty space at the end of a group from above,
        // then you actually want to be just after the outside of the group

        // If the group (tail's parent) has the same parent we do, then removing
        // this node will update it's index, so we need to avoid overshooting
        const targetParentParentPath = targetParentPath.slice(0, -1);
        const offset = _.isEqual(sourceParentPath, targetParentParentPath)
            ? 0
            : 1;

        return {
            sourcePath,
            targetPath: displacedItemPath
                .slice(0, -2) // Without the tail or parent group index
                .concat(displacedItemPath[displacedItemPath.length - 2] + offset) // _After_ the parent group
        }
    }

    if (!_.isEqual(sourceParentPath, targetParentPath)) {
        // Moving in/out of a group, displacing an item there. This means we can't
        // do a simple move, because the displaced target won't move as we expect
        // (when we remove the source element, the targets index won't change).
        const targetIndex = _.last(displacedItemPath)!;

        return {
            sourcePath,
            targetPath: pathComparison < 0
                // The item to displace is above the source item (going upwards)
                ? targetParentPath.concat(targetIndex)
                // The item to displace is below the source item (going downwards)
                // We know its not equal, due to the outer equal parent check
                : targetParentPath.concat(targetIndex + 1)
        };
    }

    return { sourcePath, targetPath: displacedItemPath };
}

@observer
export class RuleList extends React.Component<{
    draftRules: HtkRuleRoot,
    activeRules: HtkRuleRoot,

    addRule: () => void,
    saveRule: (path: ItemPath) => void,
    resetRule: (path: ItemPath) => void,
    cloneItem: (path: ItemPath) => void,
    deleteItem: (path: ItemPath) => void,
    toggleRuleCollapsed: (id: string) => void,
    updateGroupTitle: (groupId: string, title: string) => void,
    getRuleDefaultStep: (ruleType: RuleType) => Step,

    moveRule: (currentPath: ItemPath, targetPath: ItemPath) => void,
    combineRulesAsGroup: (sourcePath: ItemPath, targetPath: ItemPath) => void,

    collapsedRulesMap: { [id: string]: boolean }
}> {

    @observable currentlyDraggingRuleId: string | undefined;

    private wasGroupOpenBeforeDrag: boolean | undefined;

    @action.bound
    beforeDrag({ draggableId }: BeforeCapture) {
        this.currentlyDraggingRuleId = draggableId;

        const item = findItem(this.props.draftRules, { id: draggableId });
        if (item && isRuleGroup(item)) {
            this.wasGroupOpenBeforeDrag = !item.collapsed;
            item.collapsed = true;
        } else {
            this.wasGroupOpenBeforeDrag = undefined;
        }
    }

    buildDragEndListener = (indexMapping: Array<ItemPath>, rules: HtkRuleRoot) =>
        action(({ source, destination, combine }: DropResult) => {
            this.currentlyDraggingRuleId = undefined;

            const { draftRules } = this.props;

            if (combine) {
                const sourcePath = indexMapping[source.index];
                const isTail = combine.draggableId.endsWith('-tail');
                const targetId = isTail ? combine.draggableId.slice(0, -5) : combine.draggableId;

                const targetPath = findItemPath(draftRules, { id: targetId })!;
                const targetItem = getItemAtPath(draftRules, targetPath);

                if (isRuleGroup(targetItem)) {
                    this.props.moveRule(
                        sourcePath,
                        targetPath.concat(isTail ? targetItem.items.length : 0)
                    );
                } else {
                    this.props.combineRulesAsGroup(
                        sourcePath,
                        targetPath
                    );
                }

                return;
            }

            if (!destination) {
                if (this.wasGroupOpenBeforeDrag) {
                    const path = indexMapping[source.index];
                    const item = getItemAtPath(draftRules, path) as HtkRuleGroup;
                    item.collapsed = false;
                }

                return;
            }

            const { sourcePath, targetPath } = getDragTarget(
                indexMapping,
                rules,
                source.index,
                destination.index
            );

            this.props.moveRule(
                sourcePath,
                targetPath
            );

            if (this.wasGroupOpenBeforeDrag) {
                const item = getItemAtPath(draftRules, targetPath) as HtkRuleGroup;
                item.collapsed = false;
            }
        });

    render() {
        const {
            draftRules,
            activeRules,

            addRule,
            saveRule,
            resetRule,
            deleteItem,
            cloneItem,
            toggleRuleCollapsed,
            updateGroupTitle,
            getRuleDefaultStep,

            collapsedRulesMap
        } = this.props;
        const {
            beforeDrag,
            buildDragEndListener,
            currentlyDraggingRuleId,
        } = this;


        const { ruleRows, indexMapping } = buildRuleRows(
            draftRules,
            activeRules,
            collapsedRulesMap,
            currentlyDraggingRuleId,
            toggleRuleCollapsed,
            saveRule,
            resetRule,
            cloneItem,
            deleteItem,
            updateGroupTitle,
            getRuleDefaultStep
        );

        return <DragDropContext
            onBeforeCapture={beforeDrag}
            onDragEnd={buildDragEndListener(indexMapping, draftRules)}
        >
            <Droppable
                isCombineEnabled={true}
                droppableId='modify-rule-list'
            >{(provided) => <Observer>{() =>
                <RuleListContainer
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                >
                    <AddRuleRow
                        onAdd={addRule}
                        disabled={currentlyDraggingRuleId !== undefined}
                    />

                    { ruleRows }

                    { provided.placeholder }
                </RuleListContainer>
            }</Observer>}</Droppable>
        </DragDropContext>
    };
}

type RuleRowsData = { indexMapping: Array<ItemPath>, ruleRows: Array<React.ReactNode> };

function buildRuleRows(
    allDraftRules: HtkRuleRoot,
    allActiveRules: HtkRuleRoot,
    collapsedRulesMap: { [id: string]: boolean },
    currentlyDraggingRuleId: string | undefined,

    toggleRuleCollapsed: (ruleId: string) => void,
    saveRule: (path: ItemPath) => void,
    resetRule: (path: ItemPath) => void,
    cloneItem: (path: ItemPath) => void,
    deleteItem: (path: ItemPath) => void,
    updateGroupTitle: (groupId: string, title: string) => void,
    getRuleDefaultStep: (ruleType: RuleType) => Step,

    ruleGroup: HtkRuleGroup = allDraftRules,
    ruleGroupPath: ItemPath = [],
    overallStartIndex = 0,
): RuleRowsData {
    const rowEventSteps = {
        toggleRuleCollapsed,
        saveRule,
        resetRule,
        cloneRule: cloneItem,
        deleteRule: deleteItem,
        getRuleDefaultStep
    };

    return ruleGroup.items.reduce<RuleRowsData>((result, item, index) => {
        const itemPath = ruleGroupPath.concat(index);

        if (isRuleGroup(item)) {
            result.ruleRows.push(
                <GroupHeader
                    key={item.id}
                    group={item}
                    path={itemPath}
                    index={overallStartIndex + result.indexMapping.length}
                    collapsed={!!item.collapsed}
                    updateGroupTitle={updateGroupTitle}
                    cloneGroup={cloneItem}
                    deleteGroup={deleteItem}
                />
            );
            result.indexMapping.push(itemPath);

            // We skip the children & tail of collapsed groups
            if (item.collapsed) return result;

            const subResult = buildRuleRows(
                allDraftRules,
                allActiveRules,
                collapsedRulesMap,
                currentlyDraggingRuleId,

                toggleRuleCollapsed,
                saveRule,
                resetRule,
                cloneItem,
                deleteItem,
                updateGroupTitle,
                getRuleDefaultStep,

                item,
                itemPath,
                overallStartIndex + result.indexMapping.length
            );

            result.ruleRows.push(...subResult.ruleRows);
            result.indexMapping.push(...subResult.indexMapping);

            result.ruleRows.push(
                <GroupTail
                    key={item.id + '-tail'}
                    group={item}
                    index={overallStartIndex + result.indexMapping.length}
                />
            );
            // The tail element maps to the empty space after the end of the group
            result.indexMapping.push(itemPath.concat(item.items.length));
        } else {
            const isCollapsed = collapsedRulesMap[item.id];
            const changed = getChangedState(item, itemPath, allDraftRules, allActiveRules);

            result.ruleRows.push(<RuleRow
                key={item.id}
                index={overallStartIndex + result.indexMapping.length}

                path={itemPath}
                rule={item}

                isNewRule={changed === 'new'}
                hasUnsavedChanges={!!changed}

                collapsed={isCollapsed}
                disabled={
                    // When dragging, disable all other rules
                    currentlyDraggingRuleId !== undefined &&
                    currentlyDraggingRuleId !== item.id
                }

                {...rowEventSteps}
            />);

            result.indexMapping.push(itemPath);
        }

        return result;
    }, { indexMapping: [], ruleRows: [] });
}

function getChangedState(
    draftRule: HtkRule,
    draftPath: ItemPath,
    draftRules: HtkRuleRoot,
    activeRules: HtkRuleRoot
): 'changed' | 'new' | false {
    const activePath = findItemPath(activeRules, { id: draftRule.id });
    if (!activePath) return 'new';

    const draftParent = getItemParentByPath(draftRules, draftPath);
    const activeParent = getItemParentByPath(activeRules, activePath);
    const activeRule = activeParent.items[_.last(activePath)!];

    if (activeParent.id !== draftParent.id) {
        // Changed group
        return 'changed';
    }

    const activeCommonSiblings = _.intersectionBy(activeParent.items, draftParent.items, 'id');
    const draftCommonSiblings = _.intersectionBy(draftParent.items, activeParent.items, 'id');

    if (activeCommonSiblings.indexOf(activeRule) !== draftCommonSiblings.indexOf(draftRule)) {
        // Changed order within group
        return 'changed';
    }

    if (!_.isEqualWith(activeRule, draftRule, areItemsEqual)) {
        // Rule content changed
        return 'changed';
    }

    return false;
}