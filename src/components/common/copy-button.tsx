import * as React from 'react';

import { Icon } from "../../icons";
import { styled } from '../../styles';
import { reportError } from '../../errors';

import { clickOnEnter } from '../component-utils';
import { UnstyledButton } from './inputs';
import { PillButton } from './pill';

const clipboardSupported = !!navigator.clipboard;

const CopyButtonIconBase = styled(UnstyledButton)`
    cursor: pointer;
    color: ${p => p.theme.mainColor};

    &:hover, &:focus {
        color: ${p => p.theme.popColor};
        font-weight: bold;
        outline: none;
    }

    &:active {
        color: ${p => p.theme.mainColor};
    }
`;

const buildCopyComponent = (BaseComponent: typeof CopyButtonIconBase | typeof PillButton) =>
    (p: { className?: string, content: string, children?: React.ReactNode }) =>
        clipboardSupported
            ? <BaseComponent
                    className={p.className}
                    tabIndex={0}
                    onKeyDown={clickOnEnter}
                    onClick={() => copyToClipboard(p.content)}
                >
                    <Icon
                        icon={['far', 'copy']}
                    />
                    { p.children }
                </BaseComponent>
            : null;

export const CopyButtonIcon = buildCopyComponent(CopyButtonIconBase);
export const CopyButtonPill = buildCopyComponent(PillButton);

async function copyToClipboard(content: string) {
    try {
        await navigator.clipboard!.writeText(content);
    } catch (e) {
        console.log('Failed to copy to the clipboard');
        reportError(e);
    }
}