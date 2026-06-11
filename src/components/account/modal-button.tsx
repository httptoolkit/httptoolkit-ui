import { styled } from "../../styles";
import { SecondaryButton } from '../common/inputs';

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
