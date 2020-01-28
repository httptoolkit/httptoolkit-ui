import * as React from 'react';
import { action } from 'mobx';
import { Observer } from 'mobx-react'
import { Method, matchers } from 'mockttp';
import { Draggable, DraggingStyle, NotDraggingStyle, DraggableStateSnapshot } from 'react-beautiful-dnd';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import {
    isRuleGroup,
    ItemPath,
    HtkMockRuleGroup
} from '../../model/rules/rules-structure';
import { getMethodColor } from '../../model/http/exchange-colors';

import { clickOnEnter } from '../component-utils';
import { TextInput } from '../common/inputs';
import { DragHandle } from './mock-drag-handle';

const CollapsedItemPlaceholder = styled.div<{
    index: number,
    borderColor: string
}>`
    position: absolute;
    top: calc(50% - ${p => p.index * 4}px);
    transform: translateY(-50%);
    height: 150%;

    left: calc(-5px + ${p => p.index * 10}px);
    right: ${p => p.index * 10}px;

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

    opacity: ${p => 1 - p.index * 0.2};
    z-index: ${p => 9 - p.index};

    border-left: 5px solid ${(p) => p.borderColor};
`;

const TitleButtons = styled.div`
    display: none; /* Made flex by container, on hover/expand */
    flex-direction: row;
    align-items: center;

    z-index: 10;

    margin-left: 5px;

    > svg {
        margin: 0 5px;
        color: ${p => p.theme.primaryInputBackground};

        &:hover {
            color: ${p => p.theme.popColor};
        }
    }
`;

const GroupHeaderContainer = styled.header<{
    depth: number,
    collapsed: boolean,
    editingTitle: boolean
}>`
    margin-top: 25px;

    width: calc(100% - 5px - ${p => p.depth * 40}px);
    margin-left: calc(5px + ${p => p.depth * 40}px);

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
    &:hover {
        ${DragHandle} {
            opacity: 0.5;
        }

        ${TitleButtons} {
            display: flex;
        }

        ${p => !p.collapsed
            ? 'text-shadow: 0 0 5px rgba(0,0,0,0.2);'
            : css`
                > ${CollapsedItemPlaceholder} {
                    box-shadow: 0 2px 20px 0 rgba(0,0,0,0.3);
                }
            `
        }
    }

    ${p => p.editingTitle && css`
        ${TitleButtons} {
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

export const GroupHeader = (p: {
    group: HtkMockRuleGroup,
    path: ItemPath,
    index: number,
    collapsed: boolean,
    updateGroupTitle: (groupId: string, title: string) => void
}) => {
    const [isEditing, setEditing] = React.useState(false);
    const [unsavedTitle, setUnsavedTitle] = React.useState(p.group.title);

    const toggleCollapsed = action(() => { p.group.collapsed = !p.group.collapsed });
    const startEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(true);
        setUnsavedTitle(p.group.title);
    };
    const editTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUnsavedTitle(e.target.value)
    }
    const resetTitle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(false);
    };
    const saveTitle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(false);
        p.updateGroupTitle(p.group.id, unsavedTitle);
    };

    return <Draggable
        draggableId={p.group.id}
        index={p.index}
    >{ (provided, snapshot) => <Observer>{ () =>
        <GroupHeaderContainer
            depth={p.path.length - 1}
            collapsed={p.collapsed}
            editingTitle={isEditing}

            {...provided.draggableProps}
            style={extendGroupDraggableStyles(provided.draggableProps.style, snapshot)}
            ref={provided.innerRef}

            onClick={toggleCollapsed}
            onKeyPress={clickOnEnter}
            tabIndex={0}
        >
            <DragHandle {...provided.dragHandleProps} />

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
                    />
                    : p.group.title
                }
            </h2>

            <TitleButtons>
                { isEditing
                    ? <>
                        <Icon
                            tabIndex={0}
                            icon={['fas', 'save']}
                            onClick={saveTitle}
                            onKeyPress={clickOnEnter}
                        />
                        <Icon
                            tabIndex={0}
                            icon={['fas', 'undo']}
                            onClick={resetTitle}
                            onKeyPress={clickOnEnter}
                        />
                    </>
                    : <Icon
                        tabIndex={0}
                        icon={['fas', 'edit']}
                        onClick={startEditing}
                        onKeyPress={clickOnEnter}
                    />
                }
            </TitleButtons>

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

                return <CollapsedItemPlaceholder
                    key={index}
                    index={index}
                    borderColor={borderColor}
                />
            }) }
        </GroupHeaderContainer>
    }</Observer>}</Draggable>;
}

const GroupTailPlaceholder = styled.div`
    width: 100%;
    height: 40px;
    margin-bottom: -20px;
`;

export const GroupTail = (p: { group: HtkMockRuleGroup, index: number }) =>
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