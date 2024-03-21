import * as React from 'react';

import { styled } from '../../styles'
import { Icon, IconProp } from '../../icons';

import { UnstyledButton, UnstyledButtonLink } from './inputs';

export const IconButton = styled((p: {
    className?: string,
    title: string,
    icon: IconProp,
    disabled?: boolean,
    fixedWidth?: boolean,
    tabIndex?: number,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void,
    onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void
}) =>
    <UnstyledButton
        className={p.className}
        title={p.title}
        tabIndex={p.tabIndex ?? (p.disabled ? -1 : 0)}
        disabled={p.disabled}
        onClick={p.onClick}
        onKeyDown={p.onKeyDown}
    >
        <Icon
            icon={p.icon}
            fixedWidth={p.fixedWidth ? true : false}
        />
    </UnstyledButton>
)`
    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.textSize};
    padding: 5px 10px;

    &:disabled {
        opacity: 0.5;
    }

    &:not([disabled]) {
        &:hover, &:focus {
            outline: none;
            color: ${p => p.theme.popColor};
        }
    }
`;

export const IconButtonLink = styled((p: {
    className?: string,
    title: string,
    icon: IconProp,
    fixedWidth?: boolean,
    href: string,
    target?: string,
    rel?: string
}) =>
    <UnstyledButtonLink
        className={p.className}
        title={p.title}
        href={p.href}
        target={p.target}
        rel={p.rel}
    >
        <Icon
            icon={p.icon}
            fixedWidth={p.fixedWidth ? true : false}
        />
    </UnstyledButtonLink>
)`
    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.textSize};
    padding: 5px 10px;

    &:hover, &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }
`;