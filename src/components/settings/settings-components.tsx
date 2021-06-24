import { styled, css } from '../../styles';
import { Button, ButtonLink } from '../common/inputs';

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
}>`
    ${SettingsButtonCss}
    margin-right: 10px;
`;

export const SettingsExplanation = styled.p`
    font-style: italic;
    margin-top: 10px;
    line-height: 1.3;
`;