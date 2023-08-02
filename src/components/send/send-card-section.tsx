import { styled } from "../../styles";
import { CollapsibleCard } from "../common/card";

export const SendCardSection = styled(CollapsibleCard)`
    border-radius: 0;
    margin-bottom: 0;

    flex-basis: auto;
    flex-shrink: 1;
    min-height: 0;

    flex-grow: ${p =>
        // Collapsed cards should not expand into unused space
        p.collapsed ? '0' : '1'
    };
`;