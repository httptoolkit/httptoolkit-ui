import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled, Theme, ThemeProps, css } from '../../styles';
import { Icon } from '../../icons';

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
            box-shadow: unset;
        }
    `}

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

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

// Card-like buttons, e.g. mock rule rows & intercept buttons
export const LittleCard = styled(Card)`
    padding: 15px;

    > header:not(:last-child), > h1:not(:last-child) {
        margin-bottom: 15px;
    }
`;

// Normal card size
export const MediumCard = styled(Card)`
    padding: 20px;
    margin-bottom: 20px;

    > header, > h1 {
        text-transform: uppercase;
        text-align: right;
        color: ${p => p.theme.containerWatermark};

        &:not(:last-child) {
            margin-bottom: 20px;
        }
    }
`;

// Oversized cards for extra info - used for Connected Sources UI
export const BigCard = styled(MediumCard)`
    padding: 30px;

    > header:not(:last-child), > h1:not(:last-child) {
        margin-bottom: 30px;
    }
`;

export interface CollapsibleCardProps {
    collapsed: boolean;
    expanded?: boolean;
    direction?: 'left' | 'right';

    className?: string;

    onCollapseToggled?: () => void;
}

@observer
export class CollapsibleCard extends React.Component<
    CollapsibleCardProps & React.HTMLAttributes<HTMLDivElement>
> {

    private cardRef = React.createRef<HTMLElement>();

    render() {
        return <CollapsibleCardContainer
            className={this.props.className}
            collapsed={this.props.collapsed}
            expanded={this.props.expanded ?? false}
            direction={this.props.direction}

            tabIndex={0}
            ref={this.cardRef}
            onKeyDown={this.onKeyDown}
        >{
            this.renderChildren()
        }</CollapsibleCardContainer>;
    }

    renderChildren() {
        const { children, collapsed } = this.props;

        const showCollapseIcon = !!this.props.onCollapseToggled;

        return React.Children.map(children as React.ReactElement<any>[], (child, i) =>
            (i === 0 && showCollapseIcon)
                // If we have a collapse handler, inject a collapse button as the
                // last child of our first child:
                ? React.cloneElement(child, { },
                    React.Children.toArray(child.props.children).concat(
                        <CollapseIcon
                            key='collapse-icon'
                            collapsed={collapsed}
                            onClick={this.toggleCollapse}
                        />
                    )
                )
            : (i === 0 && !showCollapseIcon)
                ? child
            : !collapsed
                ? child
            : null // When collapsed, skip all but the first child
        );
    }

    toggleCollapse = () => {
        // Should never happen, but guard against it just in case:
        if (!this.props.onCollapseToggled) return;

        // Scroll the element into view, after giving it a moment to rerender
        requestAnimationFrame(() => {
            if (!this.cardRef.current) return;

            this.cardRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        });

        this.props.onCollapseToggled();
    }

    onKeyDown = (event: React.KeyboardEvent) => {
        if (event.target !== this.cardRef.current) {
            return;
        }

        if (event.key === 'Enter') {
            this.toggleCollapse();
        }
    }

}

interface CollapseIconProps extends ThemeProps<Theme> {
    className?: string;
    onClick: () => void;
    collapsed: boolean;
}

const CollapseIcon = styled((props: CollapseIconProps) =>
    <Icon
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

// Bit of redundancy here, but just because the TS styled plugin
// gets super confused if you use variables in property names.
const cardDirectionCss = (direction?: string) =>
    direction === 'right' ? css`
        padding-right: 15px;
        border-right: solid 5px ${p => p.theme.containerBorder};
    ` :
    direction === 'left' ? css`
        padding-left: 15px;
        border-left: solid 5px ${p => p.theme.containerBorder};
    ` : '';

const CollapsibleCardContainer = styled(MediumCard)<{
    collapsed: boolean;
    expanded: boolean;
    direction?: 'left' | 'right';
}>`
    display: flex;
    flex-direction: column;

    transition: margin-bottom 0.1s;

    ${p => p.collapsed && css`
        :not(:last-child) {
            margin-bottom: -16px;
        }
    `}

    ${p => p.expanded && css`
        height: 100%;
        width: 100%;
        border-radius: 0;
        margin: 0;

        flex-shrink: 1;
        min-height: 0;
    `}

    &:focus {
        ${CollapseIcon} {
            color: ${p => p.theme.popColor};
        }
    }

    &:focus-within {
        header h1 {
            color: ${p => p.theme.popColor};
        }

        outline: none;
        border-color: ${p => p.theme.popColor};
    }

    ${p => cardDirectionCss(p.direction)};
`;

export const CollapsibleCardHeading = styled((p: {
    className?: string,
    onCollapseToggled?: () => void,
    children: React.ReactNode
}) => <h1 className={p.className} onClick={p.onCollapseToggled}>
    { p.children }
</h1>)`
    cursor: pointer;
    user-select: none;
`;