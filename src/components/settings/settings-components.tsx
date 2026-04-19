import { styled, css } from '../../styles';

import { Button, ButtonLink } from '../common/inputs';
import { ContentLabel } from '../common/text-content';

const SettingsButtonCss = css`
    font-size: ${p => p.theme.textSize};
    padding: 6px 16px;

    ${(p: { highlight?: boolean }) => p.highlight && css`
        &:not(:disabled) {
            background-color: ${p => p.theme.popColor};
        }
    `}
`;

export const SettingsButton = styled(Button)`${SettingsButtonCss}`;
export const SettingsButtonLink = styled(ButtonLink)<{
    highlight?: boolean
}>`${SettingsButtonCss}`;

export const SettingsExplanation = styled.p`
    font-style: italic;
    line-height: 1.3;
`;

export const SettingsSubheading = styled(ContentLabel)`
    &:not(header + &):not(:first-child) {
        margin-top: 40px;
    }
`;

// Subheaders can be wrapped with this if there are other controls
export const SettingsSubheadingRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: start;

    &:not(header + &) {
        margin-top: 40px;
    }

    ${SettingsSubheading} {
        margin-top: 0;
    }
`;