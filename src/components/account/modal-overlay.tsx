import { styled } from "../../styles";
import { SecondaryButton } from '../common/inputs';

export const ModalOverlay = styled.div<{ opacity?: number }>`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;

    background: ${p => p.theme.modalGradient};

    z-index: 10;
    opacity: ${p => p.opacity || 0.9};
`;

export const ModalButton = styled(SecondaryButton)`
    padding: 5px 20px;
    margin: 20px auto;

    &:not([disabled]) {
        color: ${p => p.theme.mainBackground};
        border-color: ${p => p.theme.mainBackground};
    }

    border-color: rgba(255, 255, 255, 0.6);
    font-size: ${p => p.theme.textSize};
`;