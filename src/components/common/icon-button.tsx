import * as React from 'react';

import { styled } from '../../styles'
import { Icon, IconProp } from '../../icons';

import { clickOnEnter } from '../component-utils';
import { UnstyledButton } from './inputs';

export const IconButton = styled((p: {
    className?: string,
    title: string,
    icon: IconProp,
    disabled?: boolean,
    onClick: () => void
}) =>
    <UnstyledButton
        className={p.className}
        title={p.title}
        tabIndex={p.disabled ? -1 : 0}
        disabled={p.disabled}
        onClick={p.onClick}
        onKeyPress={clickOnEnter}
    >
        <Icon icon={p.icon} />
    </UnstyledButton>
)`
    color: ${p => p.theme.mainColor};
    font-size: 20px;
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