import * as React from 'react';

import { Icon } from "../../icons";
import { styled } from '../../styles';
import { reportError } from '../../errors';

import { clickOnEnter } from '../component-utils';
import { PillButton } from './pill';
import { IconButton } from './icon-button';

const clipboardSupported = !!navigator.clipboard;

const CopyIconButton = styled(IconButton)`
    color: ${p => p.theme.mainColor};

    &:hover, &:focus {
        color: ${p => p.theme.popColor};
        outline: none;
    }

    &:active {
        color: ${p => p.theme.mainColor};
    }
`;

export const CopyButtonIcon = (p: {
    className?: string,
    content: string,
    onClick?: () => void
}) => clipboardSupported
    ? <CopyIconButton
        title="Copy this to your clipboard"
        className={p.className}
        icon={['far', 'copy']}
        onClick={() => {
            copyToClipboard(p.content);
            if (p.onClick) p.onClick();
        }}
    />
    : null;

export const CopyButtonPill = (p: { content: string, children?: React.ReactNode }) =>
    clipboardSupported
        ? <PillButton
            tabIndex={0}
            onKeyDown={clickOnEnter}
            onClick={() => copyToClipboard(p.content)}
        >
            <Icon icon={['far', 'copy']} />
            { p.children }
        </PillButton>
    : null;

async function copyToClipboard(content: string) {
    try {
        await navigator.clipboard!.writeText(content);
    } catch (e) {
        console.log('Failed to copy to the clipboard');
        reportError(e);
    }
}