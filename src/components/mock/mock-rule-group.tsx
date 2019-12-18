import * as React from 'react';
import { action } from 'mobx';
import { Observer } from 'mobx-react'
import { Method, matchers } from 'mockttp';
import { Draggable } from 'react-beautiful-dnd';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import {
    isRuleGroup,
    ItemPath,
    HtkMockRuleGroup
} from '../../model/rules/rules';
import { getMethodColor } from '../../model/exchange-colors';

import { clickOnEnter } from '../component-utils';
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

const GroupHeaderContainer = styled.header<{
    depth: number,
    collapsed: boolean
}>`
    margin-top: 25px;

    width: calc(100% - 5px - ${p => p.depth * 40}px);
    margin-left: calc(5px + ${p => p.depth * 40}px);

    padding: 5px 20px 5px 15px;
    box-sizing: border-box;

    display: flex;
    align-items: center;

    position: relative;

    cursor: pointer;
    &:active, &:focus {
        outline: none;
        > h2 > svg {
            color: ${p => p.theme.popColor};
        }
    }
    &:hover {
        ${DragHandle} {
            opacity: 0.5;
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

    font-size: ${(p) => p.theme.headingSize};

    > h2 {
        user-select: none;
        z-index: 10;

        > svg {
            margin-right: 10px;
        }
    }
`;

export const GroupHeader = (p: {
    group: HtkMockRuleGroup,
    path: ItemPath,
    index: number,
    collapsed: boolean
}) =>
    <Draggable
        draggableId={p.group.id}
        index={p.index}
    >{ (provided) => <Observer>{ () =>
        <GroupHeaderContainer
            depth={p.path.length - 1}
            collapsed={p.collapsed}

            {...provided.draggableProps}
            ref={provided.innerRef}

            onClick={action(() => { p.group.collapsed = !p.group.collapsed })}
            onKeyPress={clickOnEnter}
            tabIndex={0}
        >
            <DragHandle {...provided.dragHandleProps} />

            <h2>
                <Icon
                    icon={['fas', p.group.collapsed ? 'chevron-down' : 'chevron-up']}
                /> { p.group.title }
            </h2>

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