import { styled, css } from '../../styles';
import { Button, ButtonLink } from '../common/inputs';

const SettingsButtonCss = css`
    font-size: ${p => p.theme.textSize};
    padding: 6px 16px;
`;

export const SettingsButton = styled(Button)`${SettingsButtonCss}`;
export const SettingsButtonLink = styled(ButtonLink)`
    ${SettingsButtonCss}
    margin-right: 10px;
`;