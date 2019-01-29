import * as React from 'react';
import { styled, Theme } from "../../styles";
import { FontAwesomeIcon } from "../../icons";
import { filterProps } from '../component-utils';

interface CloseButtonProps {
    onClose?: () => void;
    inverted?: boolean;
    top?: string;
    right?: string;

    theme?: Theme;
}

export const CloseButton = styled(
    filterProps(FontAwesomeIcon, 'inverted')
).attrs((props: CloseButtonProps) => ({
    icon: ['fas', 'times'],
    size: '2x',

    tabIndex: !!props.onClose ? 0 : -1,
    onClick: props.onClose,
    onKeyPress: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && props.onClose) {
            props.onClose();
        }
    }
}))`
    position: absolute;
    cursor: pointer;

    color: ${(p: CloseButtonProps) => p.inverted ?
        p.theme!.mainBackground : p.theme!.mainColor
    };

    top: ${p => p.top || '15px'};
    right: ${p => p.right || '15px'};
`;