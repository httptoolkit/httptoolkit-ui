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
    }
`;

export const UnstyledButton = styled.button`
    /* Reset styles that get broken because <button> overrides them: */
    border: none;
    background: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
` as StyledComponent<"button", Theme>;

export const Button = styled.button`
    -webkit-appearance: none;
    cursor: pointer;
    padding: 15px 36px;
    border-radius: 4px;
    border: none;

    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.headingSize};

    /*
     * Need both to ensure link button colours have higher
     * specificity than the a:visited default.
     */
    &, &:visited {
        color: ${p => p.theme.primaryInputColor};
    }

    display: block;
    text-decoration: none;
    text-align: center;
    font-weight: inherit;
    line-height: normal;

    ${interactiveMouseoverStyles}

    &[disabled] {
        background-color: ${p => p.theme.containerWatermark};
    }

    &:not([disabled]) {
        background-color: ${p => p.theme.primaryInputBackground};
    }
`;

export const ButtonLink = Button.withComponent('a');

const invalidTextCss = css`
    border-color: #f1971f;
    background-color: #f1971f40;
    color: ${p => p.theme.mainColor};
`;

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean
}

export const TextInput = styled.input.attrs({
    type: 'text'
})`
    padding: 5px 10px;
    border-radius: 4px;
    border: solid 1px ${p => p.theme.containerBorder};

    &:invalid {
        ${invalidTextCss}
    }

    ${(p: TextInputProps) => p.invalid && invalidTextCss}
` as StyledComponent<'input', Theme, TextInputProps>;