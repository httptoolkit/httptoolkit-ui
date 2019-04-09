import * as React from 'react';

import { FontAwesomeIcon } from "../../icons";
import { styled } from '../../styles';
import { reportError } from '../../errors';

const clipboardSupported = !!navigator.clipboard;

interface CopyProps {
    className?: string;
    content: string;
}

export const CopyButton = styled((p: CopyProps) =>
    clipboardSupported ? <FontAwesomeIcon
        className={p.className}
        icon={['far', 'copy']}
        tabIndex={0}
        onKeyDown={(event: React.KeyboardEvent) => {
            if (event.key === 'Enter') copyToClipboard(p.content)
        }}
        onClick={() => copyToClipboard(p.content)}
    /> : null
)`
    cursor: pointer;
    color: ${p => p.theme.mainColor};

    &:hover {
        color: ${p => p.theme.popColor};
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