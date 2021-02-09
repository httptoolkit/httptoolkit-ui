import * as _ from 'lodash';
import * as React from 'react';

import { styled, css } from '../../styles';
import { Icon, IconProp } from '../../icons';

import { clickOnEnter } from '../component-utils';

export const IconMenu = styled.div<{ topOffset: number }>`
    position: absolute;
    top: ${p => p.topOffset}px;
    right: 10px;

    display: none; /* Made flex by container, on hover/expand */
    flex-direction: row-reverse;
    align-items: center;
`;

export const IconMenuButton = styled(React.memo((p: {
    className?: string,
    icon: IconProp,
    title: string,
    onClick: (event: React.MouseEvent) => void,
    disabled?: boolean
}) => <Icon
    className={p.className}
    icon={p.icon}
    title={p.title}
    tabIndex={p.disabled ? -1 : 0}
    onKeyPress={clickOnEnter}
    onClick={p.disabled ? _.noop : p.onClick}
/>))`
    padding: 5px;
    margin: 0 5px;

    z-index: 10;

    font-size: 1.2em;

    ${p => p.disabled
        ? css`
            color: ${p => p.theme.containerWatermark};
        `
        : css`
            cursor: pointer;
            color: ${p => p.theme.primaryInputBackground};

            &:hover, &:focus {
                outline: none;
                color: ${p => p.theme.popColor};
            }
        `
    }
`;