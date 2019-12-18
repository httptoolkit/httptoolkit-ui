import * as React from 'react';

import { styled } from '../../styles';
import { Icon } from '../../icons';

const FloatingDragHandle = styled.div`
    position: absolute;
    left: -31px;
    top: calc(50% - 1px);
    transform: translateY(-50%);

    cursor: row-resize;

    opacity: 0;

    :focus, :active {
        outline: none;
        opacity: 0.5;
        color: ${p => p.theme.popColor};
    }

    && svg {
        margin: 0;
    }
`;

export const DragHandle = styled((props: {}) =>
    <FloatingDragHandle {...props}>
        <Icon icon={['fas', 'grip-vertical']} />
    </FloatingDragHandle>
)``;