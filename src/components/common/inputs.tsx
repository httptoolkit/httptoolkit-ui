import { StyledComponent } from "styled-components";
import { styled, Theme, css } from "../../styles";

export const interactiveMouseoverStyles = css`
    &[disabled] {
        cursor: default;
    }

    &:not([disabled]) {
        cursor: pointer;
        &:hover {
            background-image: linear-gradient(transparent, rgba(0,0,0,.05) 40%, rgba(0,0,0,.1));
        }

        &:active {
            background-image: linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.05) 40%, transparent);
        }

        &:focus {
            outline-offset: -1px;
        }
    }
`;

export const UnstyledButton = styled.button.attrs(() => ({
    // 'submit' is the default, which makes 'enter' behaviour super wacky:
    'type': 'button'
}))`
    /* Reset styles that get broken because <button> overrides them: */
    border: none;
    background: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;

    &[disabled] {
        cursor: default;
    }

    &:not([disabled]) {
        cursor: pointer;
    }
` as StyledComponent<"button", Theme>;
export const UnstyledButtonLink = UnstyledButton.withComponent('a');

const BaseButtonStyles = css`
    -webkit-appearance: none;
    cursor: pointer;
    padding: 15px 36px;
    border-radius: 4px;
    border: none;

    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.headingSize};

    display: block;
    text-decoration: none;
    text-align: center;
    font-weight: inherit;
    line-height: normal;

    ${interactiveMouseoverStyles}
`;

export const Button = styled.button`
    ${BaseButtonStyles}

    /*
     * Need both to ensure link button colours have higher
     * specificity than the a:visited default.
     */
    &, &:visited {
        color: ${p => p.theme.primaryInputColor};
    }

    &[disabled] {
        background-color: ${p => p.theme.containerWatermark};
    }

    &:not([disabled]) {
        background-color: ${p => p.theme.primaryInputBackground};
    }
`;
// 'submit' is the default, which makes 'enter' behaviour super wacky:
Button.defaultProps = { type: "button" };

export const ButtonLink = Button.withComponent('a');

export const SecondaryButton = styled.button.attrs(() => ({
    // 'submit' is the default, which makes 'enter' behaviour super wacky:
    'type': 'button'
}))`
    ${BaseButtonStyles}

    background-color: transparent;

    &, &:visited {
        color: ${p => p.theme.secondaryInputColor};
    }

    border-width: 2px;
    border-style: solid;

    &[disabled] {
        color: ${p => p.theme.containerWatermark};
        border-color: ${p => p.theme.containerWatermark};
    }

    &:not([disabled]) {
        border-color: ${p => p.theme.secondaryInputBorder};
    }
`;

const invalidTextCss = css`
    border-color: ${p => p.theme.warningColor};
    background-color: ${p => p.theme.warningBackground};
    color: ${p => p.theme.mainColor};

    &:hover:not(:disabled) {
        border-color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.warningBackground};
    }
`;

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean
}

export const TextInput = styled.input.attrs((p: { type?: string }) => ({
    type: p.type || "text"
}))`
    font-size: ${p => p.theme.textInputFontSize};
    padding: 5px 10px;
    border-radius: 4px;
    border: solid 1px ${p => p.theme.inputBorder};

    min-width: 20px; /* Without this, editable headers especially refuse to shrink */

    background-color: ${p => p.theme.inputBackground};
    &:hover:not(:disabled) {
        background-color: ${p => p.theme.inputHoverBackground};
    }

    &:focus {
        outline-offset: -1px;
    }

    color: ${p => p.theme.inputColor};

    &:disabled {
        opacity: 0.6;
    }

    &:invalid {
        ${invalidTextCss}
    }

    &:read-only {
        cursor: default;
        outline: none;
    }

    ${(p: TextInputProps) => p.invalid && invalidTextCss}
` as StyledComponent<'input', Theme, TextInputProps>;

export const Select = styled.select`
    ${interactiveMouseoverStyles}

    font-size: ${p => p.theme.headingSize};
    font-family: ${p => p.theme.fontFamily};

    width: 100%;
    border-radius: 4px;
`;