import React from "react";
import { inject, observer } from "mobx-react";

import { styled } from "../../styles";
import { FontAwesomeIcon } from "../../icons";

import { UiStore } from "../../model/ui-store";

import { Pill } from "./pill";
import { UnstyledButton } from "./inputs";
import { AccountStore } from "../../model/account/account-store";

export const ProPill = styled(inject('uiStore')((p: { uiStore?: UiStore, className?: string }) =>
    <Pill className={p.className} color={p.uiStore!.theme.popColor}>PRO</Pill>
))`
    font-size: ${p => p.theme.textSize};

    color: #e1421f;
    background-color: rgba(225,66,31,0.2);
`;

export const ProHeaderPill = styled(ProPill)`
    margin-right: auto;
`;

export const CardSalesPitch = inject('accountStore')(observer((p: {
    children: React.ReactNode,
    accountStore?: AccountStore
}) => <CardSalesPitchContainer>

    { p.children }

    <GetProButton onClick={p.accountStore!.getPro}>
        <FontAwesomeIcon icon={['far', 'star']} size='2x' />
        Get HTTP Toolkit Pro
    </GetProButton>
</CardSalesPitchContainer>));

const CardSalesPitchContainer = styled.div`
    padding: 20px 25%;
    margin: 0 -20px -20px -20px;
    background-color: ${p => p.theme.mainLowlightBackground};
    box-shadow: inset 0px 12px 8px -10px rgba(0,0,0,0.15);

    p {
        color: ${p => p.theme.mainColor};
        line-height: 1.2;
        font-weight: bold;
        margin-bottom: 10px;
    }
`;

const GetProButton = styled(UnstyledButton)`
    width: 120px;
    box-sizing: border-box;
    padding: 20px;

    margin: 0 auto;

    cursor: pointer;
    user-select: none;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;

    font-weight: bold;
    color: ${p => p.theme.popColor};
    background-color: ${p => p.theme.highlightBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.3);

    > svg {
        margin-bottom: 5px;
    }
`;