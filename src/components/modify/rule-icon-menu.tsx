import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../styles';
import { IconProp } from '../../icons';

import { IconButton } from '../common/icon-button';

export const IconMenu = styled.div<{ topOffset: number }>`
    position: absolute;
    top: ${p => p.topOffset}px;
    right: 10px;

    display: none; /* Made flex by container, on hover/expand */
    align-items: center;
`;

export const IconMenuButton = styled(React.memo((p: {
    className?: string,
    icon: IconProp,
    title: string,
    onClick: (event: React.MouseEvent) => void,
    disabled?: boolean
}) => <IconButton
    className={p.className}
    icon={p.icon}
    title={p.title}
    disabled={p.disabled}
    onClick={p.onClick}
/>))`
    padding: 5px;
    margin: 0 5px;

    z-index: 10;

    font-size: 1.2em;

    > svg {
        display: block;
    }

    :disabled {
        opacity: 1;
        color: ${p => p.theme.containerWatermark};
    }

    :not(:disabled) {
        cursor: pointer;
        color: ${p => p.theme.secondaryInputColor};

        &:hover, &:focus {
            outline: none;
            color: ${p => p.theme.popColor};
        }
    }
`;