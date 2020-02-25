import { styled, Theme } from "../../styles";
import { Icon } from "../../icons";
import { filterProps, clickOnEnter } from '../component-utils';

interface CloseButtonProps {
    onClose: () => void;
    inverted?: boolean;
    top?: string;
    right?: string;

    theme?: Theme;
}

export const CloseButton = styled(
    filterProps(Icon, 'inverted')
).attrs((props: CloseButtonProps) => ({
    icon: ['fas', 'times'],
    size: '2x',

    tabIndex: 0,
    onClick: props.onClose,
    onKeyPress: clickOnEnter
}))`
    position: absolute;
    z-index: 1;
    cursor: pointer;

    color: ${(p: CloseButtonProps) => p.inverted ?
        p.theme!.mainBackground : p.theme!.mainColor
    };

    top: ${p => p.top || '15px'};
    right: ${p => p.right || '15px'};

    &:hover {
        opacity: 0.6;
    }
`;