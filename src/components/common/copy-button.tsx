import * as React from 'react';

import { FontAwesomeIcon } from "../../icons";
import { styled } from '../../styles';
import { reportError } from '../../errors';
import { UnstyledButton } from './inputs';

const clipboardSupported = !!navigator.clipboard;

interface CopyProps {
    className?: string;
    children?: React.ReactNode;
    content: string;
}

export const CopyButton = styled((p: CopyProps) =>
    clipboardSupported
        ? <UnstyledButton
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
            </UnstyledButton>
        : null
)`
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

async function copyToClipboard(content: string) {
    try {
        await navigator.clipboard!.writeText(content);
    } catch (e) {
        console.log('Failed to copy to the clipboard');
        reportError(e);
    }
}