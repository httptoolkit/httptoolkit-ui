import * as React from 'react';

import { Icon, IconKey } from '../../icons';
import { styled, css } from '../../styles';
import { omit } from 'lodash';
import { UnstyledButton } from './inputs';

export const TabbedOptionsContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

interface TabClickEvent extends React.MouseEvent {
    tabValue?: any;
}

export const TabsContainer = styled((p: {
    onClick: (tabValue: any) => void,
    isSelected: (value: any) => boolean,
    children: Array<React.ReactElement<any, typeof Tab>>
}) => <nav
    {...omit(p, 'isSelected')}
    onClick={(event: TabClickEvent) => {
        if (event.tabValue) p.onClick(event.tabValue);
    }}
>
    {
        p.children.map((tab) =>
            React.cloneElement(tab, {
                key: tab.props.value,
                selected: p.isSelected(tab.props.value)
            })
        )
    }
</nav>)`
    width: 80px;
    border-right: solid 2px ${p => p.theme.containerBackground};

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
`;

export const Tab = styled((p: {
    className?: string,
    selected?: boolean,
    icon: IconKey,
    value: any,
    children: React.ReactNode
}) =>
    <UnstyledButton
        className={p.className}
        onClick={(event: TabClickEvent) => {
            // Attach our value to the event before it bubbles to the container
            event.tabValue = p.value;
        }}
    >
        <Icon icon={p.icon} />
        { p.children }
    </UnstyledButton>
)`
    display: flex;
    flex-direction: column;
    text-align: center;
    align-items: center;

    width: 100%;
    font-size: ${p => p.theme.textSize};
    box-sizing: border-box;

    padding: 10px 20px 10px 0;

    user-select: none;
    &:hover, &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }

    opacity: 0.6;
    ${p => p.selected && css`
        opacity: 1;
        font-weight: bold;
        border-right: solid 3px ${p.theme.popColor};
        padding-right: 22px;
        position: relative;
        right: -2px;
    `}

    > svg {
        margin-bottom: 10px;
        width: 2em;
        height: auto;
    }
`;