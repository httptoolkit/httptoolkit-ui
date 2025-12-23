import * as React from 'react';

import { Icon } from "../../icons";
import { styled } from '../../styles';

import { PillButton } from './pill';
import { IconButton } from './icon-button';
import { copyToClipboard } from '../../util/ui';

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

const useTemporaryFlag = () => {
    const [flagResetTimer, setFlagResetTimer] = React.useState<number | undefined>();
    const [flagged, setFlagged] = React.useState<true | undefined>();

    const triggerFlag = () => {
        setFlagged(true);

        if (flagResetTimer) {
            clearTimeout(flagResetTimer);
            setFlagResetTimer(undefined);
        }

        setFlagResetTimer(setTimeout(() =>
            setFlagged(undefined),
            2000
        ) as unknown as number);
    }

    return [flagged, triggerFlag] as const;
}

export const CopyButtonIcon = (p: {
    className?: string,
    content: string,
    onClick: () => void
}) => {
    const [success, showSuccess] = useTemporaryFlag();

    return <CopyIconButton
        title="Copy this to your clipboard"
        className={p.className}
        icon={success ? ['fas', 'check'] : ['far', 'copy']}
        fixedWidth={true}
        onClick={() => {
            copyToClipboard(p.content);
            showSuccess();
            p.onClick();
        }}
    />;
}

export const CopyButtonPill = styled((p: {
    content: string,
    children: React.ReactNode,
    className?: string
}) => {
    const [success, showSuccess] = useTemporaryFlag();

    return <PillButton
        tabIndex={0}
        onClick={() => {
            copyToClipboard(p.content);
            showSuccess();
        }}
        className={p.className}
    >
        <Icon
            icon={success ? ['fas', 'check'] : ['far', 'copy']}
            fixedWidth={true}
        />
        { p.children }
    </PillButton>;
})`
    padding: 5px 6px;

    > svg {
        margin-right: 4px;
    }
`;