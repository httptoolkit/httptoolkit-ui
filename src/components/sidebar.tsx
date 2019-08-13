import * as React from 'react';
import { StyledComponent } from 'styled-components';
import { observer } from 'mobx-react';
import * as dedent from 'dedent';

import { styled, css, Theme } from '../styles';
import { FontAwesomeIcon } from '../icons';
import { UI_VERSION, desktopVersion, serverVersion } from '../services/service-versions';

import { UnstyledButton } from './common/inputs';
import * as logo from '../images/logo-stacked.svg';

export interface SidebarItem {
    name: string;
    icon: string[];
    position: 'top' | 'bottom';
    highlight?: true;
    url?: string;
}

interface SidebarProps {
    selectedItemIndex: number;
    items: Array<SidebarItem>;
    onSelectItem: (selectedItemIndex: number) => void;
}

const SidebarNav = styled.nav`
    width: 90px;
    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    z-index: 5;

    border-right: 1px solid rgba(0,0,0,0.12);
    box-sizing: border-box;
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-direction: column;
`

const sidebarItemStyles = css`
    width: 80px;
    height: 80px;
    margin: 0 auto;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;

    box-sizing: border-box;
`;

const SidebarLogo = styled.img.attrs({
    src: logo,
    alt: 'HTTP Toolkit logo'
})`
    ${sidebarItemStyles}
`

const SidebarSelectableItem = styled(
    UnstyledButton as StyledComponent<"button", Theme, { selected: boolean }>
)`
    ${sidebarItemStyles}

    width: calc(100% + 2px);
    margin: 0 -1px;

    cursor: pointer;
    user-select: none;
    &:hover, &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }

    border-width: 0 5px;
    border-style: solid;
    border-color: transparent;

    opacity: 0.6;

    ${(p) => p.selected && css`
        opacity: 1;
        border-right-color: ${p.theme.popColor};
    `}

    > svg {
        margin-bottom: 5px;
    }
`;

const Separator = styled.div`
    margin-top: auto;
`;

const SidebarLink = styled.a<{ highlight?: true }>`
    ${sidebarItemStyles}

    ${(p) => p.highlight && css`
        color:  ${p.theme.popColor};
        font-weight: bold;
    `};
    text-decoration: none;

    margin-bottom: 5px;

    > svg {
        margin-bottom: 5px;
    }
`;

export const Sidebar = observer((props: SidebarProps) => {
    const items = props.items.map((item, i) => {
        const itemContent = <>
            <FontAwesomeIcon size='2x' icon={item.icon} />
            {item.name}
        </>;

        if (item.url) {
            return {
                position: item.position,
                component: <SidebarLink
                    key={item.name}
                    highlight={item.highlight}
                    href='https://github.com/httptoolkit/feedback/issues/new'
                    target='_blank'
                >
                    { itemContent }
                </SidebarLink>
            }
        } else {
            return {
                position: item.position,
                component: <SidebarSelectableItem
                    key={item.name}
                    selected={i === props.selectedItemIndex}
                    onClick={() => props.onSelectItem(i)}
                >
                    { itemContent }
                </SidebarSelectableItem>
            };
        }
    });

    return <SidebarNav>
        <SidebarLogo
            title={dedent`
                UI version: ${UI_VERSION.slice(0, 8)}
                Desktop version: ${
                    desktopVersion.state === 'fulfilled'
                        ? desktopVersion.value
                        : 'Unknown'
                }
                Server version: ${
                    serverVersion.state === 'fulfilled'
                        ? serverVersion.value
                        : 'Unknown'
                }
            `}
        />

        {
            items.filter(i => i.position === 'top').map((item) => item.component)
        }
        <Separator />
        {
            items.filter(i => i.position === 'bottom').map((item) => item.component)
        }
    </SidebarNav>;
});