
import { StyledComponent } from "styled-components";
import { styled, Theme } from "../../styles";

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

    &[disabled] {
        cursor: default;
        background-color: ${p => p.theme.containerWatermark};
    }

    &:not([disabled]) {
        background-color: ${p => p.theme.primaryInputBackground};
        &:hover {
            background-image: linear-gradient(transparent, rgba(0,0,0,.05) 40%, rgba(0,0,0,.1));
        }

        &:active {
            background-image: linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.05) 40%, transparent);
        }
    }
`;

export const ButtonLink = Button.withComponent('a');