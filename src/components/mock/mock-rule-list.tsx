import * as _ from 'lodash';
import * as React from 'react';
import { observable, action } from 'mobx';
import { observer, Observer } from 'mobx-react'
import { Droppable, DragDropContext, DragStart, DropResult, Draggable, DragUpdate } from 'react-beautiful-dnd';

import { styled } from '../../styles';
import { Icon } from '../../icons';

import {
    areItemsEqual,
    HtkMockRule,
    HtkMockRuleGroup,
    ItemPath,
    findItemPath,
    HtkMockRuleRoot,
    getItemParentByPath,
    isRuleGroup,
    comparePaths,
    getItemAtPath,
} from '../../model/rules/rules';

import { AddRuleRow, RuleRow } from './mock-rule-row';

const MockRuleListContainer = styled.ol`
    padding: 0 40px 20px;
    min-height: calc(100% - 40px);
`;

function getDragTarget(
    indexMapping: Array<ItemPath>,
    rules: HtkMockRuleRoot,
    sourceIndex: number,
    destinationIndex: number
) {
    const sourcePath = indexMapping[sourceIndex];
    const displacedItemPath = indexMapping[destinationIndex];

    const pathComparison = comparePaths(sourcePath, displacedItemPath);

    const displacedItem = getItemAtPath(rules, displacedItemPath);

    const sourceParentPath = sourcePath.slice(0, -1);
    const targetParentPath = displacedItemPath.slice(0, -1);

    if (isRuleGroup(displacedItem) && pathComparison > 0) {
        // If you displace a group header below you from above, then
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
export class MockRuleList extends React.Component<{
    draftRules: HtkMockRuleRoot,
    activeRules: HtkMockRuleRoot,

    addRule: () => void,
    saveRule: (path: ItemPath) => void,
    resetRule: (path: ItemPath) => void,
    deleteRule: (path: ItemPath) => void,
    moveRule: (currentPath: ItemPath, targetPath: ItemPath) => void,

    toggleRuleCollapsed: (id: string) => void,
    collapsedRulesMap: { [id: string]: boolean }
}> {

    @observable currentlyDraggingRuleId: string | undefined;

    @action.bound
    startDrag({ draggableId }: DragStart) {
        this.currentlyDraggingRuleId = draggableId;
    }

    buildDragEndListener = (indexMapping: Array<ItemPath>, rules: HtkMockRuleRoot) =>
        action(({ source, destination }: DropResult) => {
            this.currentlyDraggingRuleId = undefined;

            if (!destination) return;

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
        });

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
            buildDragEndListener,
            currentlyDraggingRuleId,
        } = this;


        const { ruleRows, indexMapping } = buildRuleRows(
            draftRules,
            activeRules,
            collapsedRulesMap,
            currentlyDraggingRuleId,
            {
                toggleRuleCollapsed,
                saveRule,
                resetRule,
                deleteRule
            }
        );

        return <DragDropContext
            onDragStart={startDrag}
            onDragEnd={buildDragEndListener(indexMapping, draftRules)}
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

                    { ruleRows }

                    { provided.placeholder }
                </MockRuleListContainer>
            }</Observer>}</Droppable>
        </DragDropContext>
    };
}

type RuleRowsData = { indexMapping: Array<ItemPath>, ruleRows: Array<React.ReactNode> };

const GroupHeaderContainer = styled.header<{ depth: number }>`
    margin-top: 20px;

    width: calc(100% - ${p => p.depth * 20}px);
    margin-left: ${p => p.depth * 20}px;

    padding: 5px 20px;
    box-sizing: border-box;

    margin-top: 20px;

    display: flex;
    align-items: center;

    > h2 {
        font-size: ${(p) => p.theme.headingSize};
        margin-left: 10px;
    }
`;

const GroupHeader = (p: { group: HtkMockRuleGroup, path: ItemPath, index: number }) =>
    <Draggable
        draggableId={p.group.id}
        index={p.index}
        isDragDisabled={true}
    >{ (provided) => <Observer>{ () =>
        <GroupHeaderContainer
            depth={p.path.length - 1}
            {...provided.draggableProps}
            ref={provided.innerRef}
        >
            <h2>{ p.group.title }</h2>
        </GroupHeaderContainer>
    }</Observer>}</Draggable>;

const GroupTailPlaceholder = styled.div`
    width: 100%;
    height: 40px;
    margin-bottom: -20px;
`;

const GroupTail = (p: { group: HtkMockRuleGroup, index: number }) =>
    <Draggable
        draggableId={p.group.id + '-tail'}
        index={p.index}
        isDragDisabled={true}
    >{ (provided) =>
        <GroupTailPlaceholder
            {...provided.draggableProps}
            ref={provided.innerRef}
        />
    }</Draggable>;

function buildRuleRows(
    allDraftRules: HtkMockRuleRoot,
    allActiveRules: HtkMockRuleRoot,
    collapsedRulesMap: { [id: string]: boolean },
    currentlyDraggingRuleId: string | undefined,
    rowEventHandlers: any, // props of RuleRow

    ruleGroup: HtkMockRuleGroup = allDraftRules,
    ruleGroupPath: ItemPath = [],
    overallStartIndex = 0,
): RuleRowsData {
    return ruleGroup.items.reduce<RuleRowsData>((result, item, index) => {
        const itemPath = ruleGroupPath.concat(index);

        if (isRuleGroup(item)) {
            result.ruleRows.push(
                <GroupHeader
                    key={item.id}
                    group={item}
                    path={itemPath}
                    index={overallStartIndex + result.indexMapping.length}
                />
            );
            result.indexMapping.push(itemPath);

            const subResult = buildRuleRows(
                allDraftRules,
                allActiveRules,
                collapsedRulesMap,
                currentlyDraggingRuleId,
                rowEventHandlers,
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

                {...rowEventHandlers}
            />);

            result.indexMapping.push(itemPath);
        }

        return result;
    }, { indexMapping: [], ruleRows: [] });
}

function getChangedState(
    draftRule: HtkMockRule,
    draftPath: ItemPath,
    draftRules: HtkMockRuleRoot,
    activeRules: HtkMockRuleRoot
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