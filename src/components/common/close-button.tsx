import { styled, Theme } from "../../styles";
import { Icon } from "../../icons";
import { clickOnEnter } from '../component-utils';

interface CloseButtonProps {
    onClose: () => void;
    top?: string;
    right?: string;

    theme?: Theme;
}

export const CloseButton = styled(Icon).attrs((props: CloseButtonProps) => ({
    icon: ['fas', 'times'],
    size: '2x',

    tabIndex: 0,
    onClick: props.onClose,
    onKeyPress: clickOnEnter
}))`
    position: absolute;
    z-index: 1;
    cursor: pointer;

    color: ${p => p.theme!.mainColor};

    &:focus-visible {
        outline: none;
        color: ${p => p.theme!.popColor};
    }

    top: ${(p: CloseButtonProps) => p.top || '10px'};
    right: ${(p: CloseButtonProps) => p.right || '15px'};

    &:hover {
        opacity: 0.6;
    }
`;