import * as React from 'react';

import { FontAwesomeIcon } from '../../icons';
import { styled, css } from '../../styles';

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
}) => <div
    {...p}
    onClick={(event: TabClickEvent) => {
        if (event.tabValue) p.onClick(event.tabValue);
    }}
>
    {
        p.children.map((tab) =>
            React.cloneElement(tab, {
                selected: p.isSelected(tab.props.value)
            })
        )
    }
</div>)`
    width: 80px;
    padding-right: 20px;
    border-right: solid 2px ${p => p.theme.containerBackground};

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
`;

export const Tab = styled((p: {
    className?: string,
    selected?: boolean,
    icon: string[],
    value: any,
    children: React.ReactNode
}) =>
    <div
        className={p.className}
        onClick={(event: TabClickEvent) => {
            // Attach our value to the event before it bubbles to the container
            event.tabValue = p.value;
        }}
    >
        <FontAwesomeIcon icon={p.icon} size='2x' />
        { p.children }
    </div>
)`
    display: flex;
    flex-direction: column;
    text-align: center;
    align-items: center;

    width: 100%;
    font-size: ${p => p.theme.textSize};
    padding: 10px 0;
    box-sizing: border-box;

    cursor: pointer;
    &:hover {
        font-weight: bold;
    }

    ${p => p.selected && css`
        color: ${p.theme.popColor};
    `}

    > svg {
        margin-bottom: 10px;
    }
`;