import { styled, css } from '../../styles';

import { MediumCard } from '../common/card';
import { Button, SecondaryButton } from '../common/inputs';

export const HeaderCard = styled(MediumCard)`
    position: sticky;
    top: -10px;
    z-index: 2;

    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;

    flex-shrink: 0;
`;

const HeaderButtonStyles = css`
    padding: 10px 15px;
    font-weight: bold;
    font-size: ${p => p.theme.textSize};

    margin: 10px 0 0 10px;
    align-self: stretch;
`;

export const HeaderText = styled.p`
    width: 100%;
    margin-bottom: 10px;
    line-height: 1.3;

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

export const HeaderButton = styled(Button)`${HeaderButtonStyles}`;
export const SecondaryHeaderButton = styled(SecondaryButton)`${HeaderButtonStyles}`;