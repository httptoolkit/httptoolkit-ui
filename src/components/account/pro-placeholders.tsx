import React from "react";
import { inject, observer } from "mobx-react";

import { styled, popColor } from "../../styles";
import { Icon } from "../../icons";

import { UiStore } from "../../model/ui/ui-store";

import { Pill } from "../common/pill";
import { UnstyledButton } from "../common/inputs";
import { AccountStore } from "../../model/account/account-store";

export const ProPill = styled(inject('uiStore')((p: {
    uiStore?: UiStore,
    className?: string,
    children?: string
}) =>
    <Pill className={p.className} color={p.uiStore!.theme.popColor}>{ p.children || 'PRO' }</Pill>
))`
    font-size: ${p => p.theme.textSize};

    color: ${popColor};
    background-color: rgba(225,66,31,0.2);
`;

export const ProHeaderPill = styled(ProPill)`
    margin-right: auto;
`;

const GetProButton = styled(UnstyledButton)`
    box-sizing: border-box;
    padding: 20px;

    margin: 0 auto;

    user-select: none;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;

    font-weight: bold;
    color: ${p => p.theme.primaryInputColor};
    background-color: ${p => p.theme.primaryInputBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha/2});

    > svg {
        margin-bottom: 5px;
    }

    &:hover {
        background-image: linear-gradient(transparent, rgba(0,0,0,.05) 40%, rgba(0,0,0,.1));
    }

    &:active {
        background-image: linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.05) 40%, transparent);
    }
`;

export const CardSalesPitch = inject('accountStore')(observer((p: {
    children: React.ReactNode,
    source: string,
    accountStore?: AccountStore
}) => <CardSalesPitchContainer>

    { p.children }

    <GetProButton onClick={() => p.accountStore!.getPro(p.source)}>
        <Icon icon={['far', 'star']} size='2x' />
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

    ${GetProButton} {
        width: 100%;
    }
`;

const BlurOverlay = styled.div<{ inert?: boolean }>`
    filter: blur(1px);
    opacity: 0.6;

    pointer-events: none;
    user-select: none;
`;

const OverlayContainer = styled.div`
    position: relative;
    min-height: 140px;
`;

const OverlayGetProButton = styled(GetProButton)`
    position: absolute;
    top: 52%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
`;

@observer
export class GetProOverlay extends React.Component<{
    getPro: (source: string) => void,
    source: string,
    children: React.ReactNode
}> {
    private buttonRef = React.createRef<HTMLButtonElement>();

    render() {
        return <OverlayContainer>
            <OverlayGetProButton
                ref={this.buttonRef}
                onClick={() => this.props.getPro(this.props.source)}
            >
                <Icon icon={['far', 'star']} size='2x' />
                Get Pro
            </OverlayGetProButton>

            <BlurOverlay
                inert
                // 'inert' doesn't actually work - it's non-standard, so we need this:
                ref={node => node && node.setAttribute('inert', '')}
                onFocus={() =>
                    // Inert isn't well supported: quick hack to block focus on children
                    this.buttonRef.current &&
                    this.buttonRef.current.focus()
                }
            >
                { this.props.children }
            </BlurOverlay>
        </OverlayContainer>;
    }
}