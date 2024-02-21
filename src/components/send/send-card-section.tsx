import { styled } from "../../styles";
import { CollapsibleCard } from "../common/card";

export const SendCardSection = styled(CollapsibleCard)`
    border-radius: 0;
    margin-bottom: 0;

    flex-basis: auto;
    flex-shrink: 1;
    flex-grow: ${p =>
        // Collapsed cards should not expand into unused space
        p.collapsed ? '0' : '1'
    };
    min-height: 0;

    box-shadow: 0 -2px 5px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
`;

export const SendBodyCardSection = styled(SendCardSection)`
    /* This is required to force the editor to shrink to fit, instead of going
       beyond the limits of the column when other item is expanded and pushes it down */
    overflow-y: hidden;


    ${p => !p.collapsed && `
        /* When we're open, we want space more than any siblings */
        flex-grow: 9999999;

        /* If we're open, never let us get squeezed to nothing: */
        min-height: 25vh;

        /* Fixed size required to avoid editor resize thrashing */
        flex-basis: 50%;
    `
    }
`;