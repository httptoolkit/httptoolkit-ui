import * as React from 'react';

import { styled } from '../../styles';
import { Icon } from '../../icons';

import { UnstyledButton } from './inputs';
import { clickOnEnter } from '../component-utils';

const ExpandShrinkButtonContainer = styled(UnstyledButton)`
    padding: 5px 10px;
    color: ${p => p.theme.mainColor};

    &:hover, &:focus {
        color: ${p => p.theme.popColor};
        outline: none;
    }

    &:active {
        color: ${p => p.theme.mainColor};
    }
`;

export const ExpandShrinkButton = (p: { expanded: boolean, onClick: () => void }) =>
    <ExpandShrinkButtonContainer
        onClick={p.onClick}
        onKeyPress={clickOnEnter}
    >
        <Icon icon={['fas', p.expanded ? 'compress-arrows-alt' : 'expand']} />
    </ExpandShrinkButtonContainer>