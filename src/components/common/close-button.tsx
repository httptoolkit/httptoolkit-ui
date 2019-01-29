import * as React from 'react';
import { styled } from "../../styles";
import { FontAwesomeIcon } from "../../icons";

export const CloseButton = styled(FontAwesomeIcon).attrs((props) => ({
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

    color: ${p => p.inverted ? p.theme.mainBackground : p.theme.mainColor};

    top: ${p => p.top || '15px'};
    right: ${p => p.right || '15px'};
`;