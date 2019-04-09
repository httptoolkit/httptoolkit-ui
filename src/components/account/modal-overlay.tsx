import { styled } from "../../styles";

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