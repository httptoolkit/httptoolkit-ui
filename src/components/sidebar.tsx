import * as React from 'react';

import * as logo from '../images/logo.png';
import { styled, css } from '../styles';
import { FontAwesomeIcon } from '../icons';

interface SidebarProps {
    selectedPageIndex: number;
    pages: Array<{
        name: string,
        icon: string[]
    }>;
    onSelectPage: (selectedPageIndex: number) => void;
}

const SidebarNav = styled.nav`
    width: 90px;
    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    z-index: 1;

    border-right: 1px solid rgba(0,0,0,0.12);
    box-sizing: border-box;
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-direction: column;
`

const sidebarItemStyles = css`
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

const SidebarItem = styled.div<{ selected: boolean }>`
    ${sidebarItemStyles}

    width: calc(100% + 2px);
    margin: 0 -1px;

    cursor: pointer;
    user-select: none;

    border-width: 0 5px;
    border-style: solid;
    border-color: transparent;

    opacity: 0.6;

    ${(p) => p.selected && css`
        opacity: 1;
        /* TODO: ! here is a bit of a hack to make the prop typings work */
        border-right-color: ${p.theme!.popColor};
    `}

    > svg {
        margin-bottom: 5px;
    }
`;

const FeedbackButton = styled.a`
    ${sidebarItemStyles}

    color: ${p => p.theme.popColor};
    font-weight: bold;
    text-decoration: none;

    margin-top: auto;
    margin-bottom: 5px;

    > svg {
        margin-bottom: 5px;
    }
`;

export const Sidebar = (props: SidebarProps) =>
    <SidebarNav>
        <SidebarLogo />
        {props.pages.map((page, i) =>
            <SidebarItem
                key={page.name}
                selected={i === props.selectedPageIndex}
                onClick={() => props.onSelectPage(i)}
            >
                <FontAwesomeIcon size='2x' icon={page.icon} />
                {page.name}
            </SidebarItem>
        )}
        <FeedbackButton
            href='https://github.com/httptoolkit/feedback/issues/new'
            target='_blank'
        >
            <FontAwesomeIcon size='2x' icon={['far', 'comment']} />
            Give feedback
        </FeedbackButton>
    </SidebarNav>;