import * as React from 'react';

import { FontAwesomeIcon } from "../../icons";
import { styled } from '../../styles';
import { reportError } from '../../errors';
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
                    onKeyDown={(event: React.KeyboardEvent) => {
                        if (event.key === 'Enter') copyToClipboard(p.content)
                    }}
                    onClick={() => copyToClipboard(p.content)}
                >
                    <FontAwesomeIcon
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