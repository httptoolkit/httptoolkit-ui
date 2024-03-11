import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled, Theme, ThemeProps, css } from '../../styles';
import { Icon } from '../../icons';

interface CollapseIconProps extends ThemeProps<Theme> {
    className?: string;
    onClick: () => void;
    collapsed: boolean;
    headerAlignment: 'left' | 'right';
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

    ${p => p.headerAlignment === 'right'
        ? 'margin: 0 -10px 0 -3px;'
        : 'margin: 0 -3px 0 -10px;'
    }

    &:hover {
        color: ${p => p.theme.popColor};
    }
`;

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    className?: string;
    disabled?: boolean;

    // The header alignment - defaults to right if not set
    headerAlignment?: 'left' | 'right';
}

const Card = styled.section.attrs((p: CardProps) => ({
    onClick: !p.disabled ? p.onClick : undefined,
    onKeyDown: !p.disabled ? p.onKeyDown : undefined,
    tabIndex: !p.disabled ? p.tabIndex : undefined,
    headerAlignment: p.headerAlignment ?? 'right'
}))`
    box-sizing: border-box;

    ${(p: CardProps) => p.disabled && `
        opacity: 0.5;
    `}

    ${(p: CardProps) => !p.disabled && p.onClick && css`
        cursor: pointer;

        &:hover {
            box-shadow: 0 2px 20px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha * 2});
        }

        &:active {
            box-shadow: unset;
        }
    `}

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    position: relative;

    > header h1, > h1 {
        font-size: ${p => p.theme.headingSize};
        font-weight: bold;
    }

    > header {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        ${p => p.headerAlignment === 'left' && `
            flex-direction: row-reverse;
        `}

        gap: 8px;
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
        text-align: ${p => p.headerAlignment};
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

// Starting is a very brief temporary state, used to show a card as expanded but
// apply a brief animation, when expansion is first triggered
export type ExpandState = boolean | 'starting';

export interface CollapsibleCardProps {
    collapsed: boolean;
    expanded?: ExpandState;

    // The highlighted content direction - shows a border on the
    // left or right of the whole card to indicate up/downstream
    direction?: 'left' | 'right';

    // The header alignment - defaults to right if not set
    headerAlignment?: 'left' | 'right';

    ariaLabel: string;

    className?: string;

    onCollapseToggled?: () => void;
}

// A convenient type for always-expandable cards, where relevant properties are strictly required:
export interface ExpandableCardProps extends CollapsibleCardProps {
    expanded: ExpandState;
    onExpandToggled: () => void;
}

@observer
export class CollapsibleCard extends React.Component<
    CollapsibleCardProps & React.HTMLAttributes<HTMLDivElement>
> {

    private cardRef = React.createRef<HTMLElement>();

    render() {
        const collapsable = !!this.props.onCollapseToggled;

        return <CollapsibleCardContainer
            className={this.props.className}
            collapsed={this.props.collapsed}
            expanded={this.props.expanded ?? false}
            direction={this.props.direction}
            headerAlignment={this.props.headerAlignment ?? 'right'}

            tabIndex={collapsable ? 0 : undefined}
            ref={this.cardRef}
            onKeyDown={this.onKeyDown}
            aria-label={this.props.ariaLabel}
        >{
            this.renderChildren()
        }</CollapsibleCardContainer>;
    }

    renderChildren() {
        const { children, collapsed, headerAlignment } = this.props;

        const collapsable = !!this.props.onCollapseToggled;

        return React.Children.map(children as React.ReactElement<any>[], (child, i) => {
            if (i !== 0) {
                if (collapsed) return null; // When collapsed, we drop all but the first child
                else return child;
            }

            if (!collapsable) return child;

            // Otherwise: it's the first child and we want to inject a collapse icon.

            if (child.type !== 'header') {
                throw new Error(`First child of collapsible card must be a header but was ${
                    typeof child.type === 'string'
                    ? child.type
                    : child.type.name
                }`);
            }

            // If we have a collapse handler, inject a collapse button as the
            // last child of our first child:
            return  React.cloneElement(child, { },
                React.Children.toArray(child.props.children).concat(
                    <CollapseIcon
                        key='collapse-icon'
                        collapsed={collapsed}
                        onClick={this.toggleCollapse}
                        headerAlignment={headerAlignment ?? 'right'}
                    />
                )
            );

        });
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
    expanded: ExpandState;
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

    ${p => p.expanded
        ?  css`
            /* Override the Send container setting this to 'none', which hides non-expanded parts: */
            display: flex !important;

            height: 100%;
            width: 100%;
            border-radius: 0;
            margin: 0;

            flex-shrink: 1;
            min-height: 0;

            ${p.expanded === 'starting'
                ? `
                    padding-top: 40px;
                    padding-bottom: 40px;
                `
                : 'transition: padding 0.1s;'
            }
        `
        // Show card direction markers only when not expanded
        : cardDirectionCss(p.direction)
    }

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