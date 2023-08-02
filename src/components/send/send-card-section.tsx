import { styled } from "../../styles";
import { CollapsibleCard } from "../common/card";

export const SendCardSection = styled(CollapsibleCard)`
    border-radius: 0;
    margin-bottom: 0;

    ${p => p.collapsed
        // Expand/shrink the section wherever possible:
        ? `
            flex-grow: 0;
            flex-shrink: 1;
            flex-basis: 0;
        `
        : `
            flex-grow: 1;
            flex-shrink: 1;
            flex-basis: auto;
            min-height: 20vh;
        `
    }
`;