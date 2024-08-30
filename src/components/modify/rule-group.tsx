import * as React from 'react';
import { action } from 'mobx';
import { observer, Observer } from 'mobx-react-lite'
import { Method, matchers } from 'mockttp';
import {
    Draggable,
    DraggingStyle,
    NotDraggingStyle,
    DraggableStateSnapshot
} from 'react-beautiful-dnd';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import {
    isRuleGroup,
    ItemPath,
    HtkRuleGroup,
    mapRules,
    flattenRules
} from '../../model/rules/rules-structure';
import { getMethodColor } from '../../model/events/categorization';

import { clickOnEnter, noPropagation } from '../component-utils';
import { TextInput } from '../common/inputs';
import { DragHandle } from './rule-drag-handle';
import { IconMenu, IconMenuButton } from './rule-icon-menu';

const CollapsedItemPlaceholder = styled.div<{
    index: number,
    borderColor: string,
    activated: boolean
}>`
    position: absolute;
    top: calc(50% - ${p => p.index * 3}px);
    transform: translateY(-50%);
    height: 150%;

    left: calc(-5px + ${p => p.index * 10}px);
    right: ${p => p.index * 10}px;

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    opacity: ${p => (p.activated ? 1 : 0.6) - p.index * 0.2};
    z-index: ${p => 9 - p.index};

    border-left: 5px solid ${(p) => p.borderColor};
`;

const TitleButtonContainer = styled.div`
    display: none; /* Made flex by container, on hover/expand */
    flex-direction: row;
    align-items: center;
    margin-left: 5px;
`;

const TitleButton = styled(IconMenuButton)`
    font-size: 1em;
    padding: 0;
`;

const RuleGroupMenu = (p: {
    toggleState: boolean,
    onToggleActivation: (event: React.MouseEvent) => void,
    onClone: (event: React.MouseEvent) => void,
    onDelete: (event: React.MouseEvent) => void,
}) => <IconMenu topOffset={-2}>
    <IconMenuButton
        title={p.toggleState ? 'Deactivate these rules' : 'Activate these rules'}
        icon={['fas', p.toggleState ? 'toggle-on' : 'toggle-off']}
        onClick={p.onToggleActivation}
    />
    <IconMenuButton
        title='Clone this rule'
        icon={['far', 'clone']}
        onClick={p.onClone}
    />
    <IconMenuButton
        title='Delete these rules'
        icon={['far', 'trash-alt']}
        onClick={p.onDelete}
    />
</IconMenu>;

const GroupHeaderContainer = styled.header<{
    depth: number,
    collapsed: boolean,
    editingTitle: boolean
}>`
    ${p => p.collapsed
        ? `
            margin-top: 22px;
            margin-bottom: 17px;
        `
        : `
            margin-top: 10px;
        `
    }

    width: calc(100% - 5px - ${p => p.depth * 40}px);
    margin-left: calc(5px + ${p => p.depth * 40}px);

    transition: padding 0.1s ease-out;
    padding: ${p => p.collapsed
        ? '5px 20px 5px 15px'
        : '5px 20px 5px 0px'};
    box-sizing: border-box;

    display: flex;
    align-items: center;

    position: relative;

    cursor: pointer;
    &:focus {
        outline: none;
        > h2 > svg {
            color: ${p => p.theme.popColor};
        }
    }
    &:hover, &:focus-within {
        ${DragHandle} {
            opacity: 0.5;
        }

        ${TitleButtonContainer}, ${IconMenu} {
            display: flex;
        }

        ${p => !p.collapsed
            ? 'text-shadow: 0 0 5px rgba(0,0,0,0.2);'
            : css`
                > ${CollapsedItemPlaceholder} {
                    box-shadow: 0 2px 20px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
                }
            `
        }
    }

    ${p => p.editingTitle && css`
        ${TitleButtonContainer} {
            display: flex;
        }
    `}

    font-size: ${(p) => p.theme.headingSize};

    > h2 {
        user-select: none;
        z-index: 10;

        > svg {
            margin-right: 10px;
        }
    }

    input[type=text] {
        margin: -7px 0;
        position: relative;
        top: -3px;
    }
`;

const extendGroupDraggableStyles = (
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

const isFullyActiveGroup = (group: HtkRuleGroup) =>
    flattenRules(group).every(r => r.activated);

export const GroupHeader = observer((p: {
    group: HtkRuleGroup,
    path: ItemPath,
    index: number,
    collapsed: boolean,

    updateGroupTitle: (groupId: string, title: string) => void,
    cloneGroup: (path: ItemPath) => void
    deleteGroup: (path: ItemPath) => void
}) => {
    const [isEditing, setEditing] = React.useState(false);
    const [unsavedTitle, setUnsavedTitle] = React.useState(p.group.title);

    const toggleCollapsed = action(() => { p.group.collapsed = !p.group.collapsed });

    const startEditing = () => {
        setEditing(true);
        setUnsavedTitle(p.group.title);
    };
    const editTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUnsavedTitle(e.target.value)
    }
    const resetTitle = () => {
        setEditing(false);
    };
    const saveTitle = () => {
        setEditing(false);
        p.updateGroupTitle(p.group.id, unsavedTitle);
    };

    const allRulesActivated = isFullyActiveGroup(p.group);
    const toggleActivation = noPropagation(action(() => {
        mapRules(p.group, (rule) => {
            rule.activated = !allRulesActivated;
        });
    }));

    const deleteGroup = noPropagation(() => p.deleteGroup(p.path));
    const cloneGroup = noPropagation(() => p.cloneGroup(p.path));

    return <Draggable
        draggableId={p.group.id}
        index={p.index}
    >{ (provided, snapshot) => <Observer>{ () =>
        <GroupHeaderContainer
            depth={p.path.length - 1}
            aria-expanded={!p.collapsed}
            collapsed={p.collapsed}
            editingTitle={isEditing}

            {...provided.draggableProps}
            style={extendGroupDraggableStyles(provided.draggableProps.style, snapshot)}
            ref={provided.innerRef}

            onClick={toggleCollapsed}
            onKeyPress={clickOnEnter}
            tabIndex={0}
        >
            <DragHandle
                aria-label={`Drag handle for the '${
                    isEditing
                        ? unsavedTitle
                        : p.group.title
                }' rule group`}
                {...provided.dragHandleProps}
            />

            <h2>
                <Icon
                    icon={['fas', p.group.collapsed ? 'chevron-down' : 'chevron-up']}
                />
                { isEditing
                    ? <TextInput
                        autoFocus
                        value={unsavedTitle}
                        onChange={editTitle}
                        onClick={(e) => e.stopPropagation()}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') saveTitle();
                        }}
                    />
                    : p.group.title
                }
            </h2>

            <TitleButtonContainer>
                { isEditing
                    ? <>
                        <TitleButton
                            title="Save group name"
                            icon={['fas', 'save']}
                            onClick={noPropagation(saveTitle)}
                        />
                        <TitleButton
                            title="Reset group name"
                            icon={['fas', 'undo']}
                            onClick={noPropagation(resetTitle)}
                        />
                    </>
                    : <TitleButton
                        title="Edit group name"
                        icon={['fas', 'edit']}
                        onClick={noPropagation(startEditing)}
                    />
                }
            </TitleButtonContainer>

            <RuleGroupMenu
                toggleState={allRulesActivated}
                onToggleActivation={toggleActivation}
                onClone={cloneGroup}
                onDelete={deleteGroup}
            />

            { p.collapsed && p.group.items.slice(0, 5).map((item, index) => {
                const initialMatcher = isRuleGroup(item) ? undefined : item.matchers[0];
                const method = initialMatcher === undefined
                        ? undefined
                    : initialMatcher instanceof matchers.MethodMatcher
                        ? Method[initialMatcher.method]
                    : 'unknown'

                const borderColor = method === undefined
                    ? 'transparent'
                    : getMethodColor(method);

                const activated = isRuleGroup(item)
                    ? isFullyActiveGroup(item)
                    : item.activated;

                return <CollapsedItemPlaceholder
                    key={index}
                    index={index}
                    borderColor={borderColor}
                    activated={activated}
                />
            }) }
        </GroupHeaderContainer>
    }</Observer>}</Draggable>;
});

const GroupTailPlaceholder = styled.div`
    width: 100%;
    height: 30px;
    margin-bottom: -20px;
`;

export const GroupTail = (p: { group: HtkRuleGroup, index: number }) =>
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