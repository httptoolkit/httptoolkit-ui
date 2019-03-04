import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled, Theme, ThemeProps } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { filterProps } from '../component-utils';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    className?: string;
    disabled?: boolean;
}

const Card = styled.section.attrs((p: CardProps) => ({
    onClick: !p.disabled ? p.onClick : undefined,
    onKeyDown: !p.disabled ? p.onKeyDown : undefined,
    tabIndex: !p.disabled ? p.tabIndex : undefined
}))`
    box-sizing: border-box;

    ${(p: CardProps) => p.disabled && `
        opacity: 0.5;
    `}

    ${(p: CardProps) => !p.disabled && p.onClick && `
        cursor: pointer;

        &:hover {
            box-shadow: 0 2px 20px 0 rgba(0,0,0,0.3);
        }

        &:active {
            box-shadow: inset 0 2px 10px 0 rgba(0,0,0,0.2);
        }
    `}

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

    overflow: hidden;
    position: relative;

    > header h1, > h1 {
        font-size: ${p => p.theme.headingSize};
        font-weight: bold;
    }

    > header {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }
`;

export const LittleCard = styled(Card)`
    padding: 15px;

    > header:not(:last-child), > h1:not(:last-child) {
        margin-bottom: 15px;
    }
`;

export const MediumCard = styled(Card)`
    padding: 20px;

    > header, > h1 {
        text-transform: uppercase;
        text-align: right;
        color: ${p => p.theme.containerWatermark};

        &:not(:last-child) {
            margin-bottom: 20px;
        }
    }
`;

export const BigCard = styled(MediumCard)`
    padding: 30px;

    > header:not(:last-child), > h1:not(:last-child) {
        margin-bottom: 30px;
    }
`;

interface CollapseIconProps extends ThemeProps<Theme> {
    className?: string;
    onClick: () => void;
    collapsed: boolean;
}

export const CollapseIcon = styled((props: CollapseIconProps) =>
    <FontAwesomeIcon
        className={props.className}
        icon={['fas', props.collapsed ? 'chevron-down' : 'chevron-up']}
        onClick={props.onClick}
    />
)`
    cursor: pointer;
    user-select: none;

    padding: 4px 10px;
    margin: 0 -10px 0 5px;

    &:hover {
        color: ${p => p.theme.popColor};
    }
`;

@observer
export class CollapsibleCard extends React.Component<{
    collapsed: boolean;
    children: React.ReactElement<any> | Array<React.ReactElement<any> | null>;
    onCollapseToggled: () => void;
} & React.HTMLAttributes<HTMLDivElement>> {

    private cardRef = React.createRef<HTMLElement>();

    render() {
        const { children, collapsed, onCollapseToggled } = this.props;

        return <MediumCard
            {..._.omit(this.props, ['onCollapseToggled', 'collapsed'])}
            ref={this.cardRef}
            onKeyDown={this.onKeyDown}
        >{
            React.Children.map(children as React.ReactElement<any>[], (child, i) =>
                i === 0 ?
                    React.cloneElement(child, { },
                        React.Children.toArray(child.props.children).concat(
                            <CollapseIcon
                                key='collapse-icon'
                                collapsed={collapsed}
                                onClick={onCollapseToggled}
                            />
                        )
                    )
                    : !collapsed && child
            )
        }</MediumCard>;
    }

    onKeyDown = (event: React.KeyboardEvent) => {
        if (event.target !== this.cardRef.current) {
            return;
        }

        if (event.key === 'Enter') {
            this.props.onCollapseToggled();
        }
    }

}