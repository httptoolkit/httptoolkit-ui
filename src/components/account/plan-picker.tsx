import * as _ from "lodash";
import * as React from "react";
import { observer } from "mobx-react";
import { observable, action } from "mobx";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { styled, css } from "../../styles";
import { SubscriptionPlanCode, SubscriptionPlan } from "../../model/account/subscriptions";
import { Button, ButtonLink } from "../common/inputs";
import { CloseButton } from "../common/close-button";

const PlanPickerModal = styled.dialog`
    position: absolute;

    top: 50%;
    left: 50%;

    /* There's default styling for dialog, so undo it: */
    bottom: auto;
    right: auto;

    transform: translate(-50%, -50%);
    z-index: 99;

    display: flex;
    flex-direction: column;
    color: ${p => p.theme.mainBackground};

    background-color: transparent;
    border: none;
`;

const PlanPickerHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
    letter-spacing: -1px;
    text-align: center;
`;

const PlanCycleToggle = styled.button`
    background: none;
    border: none;

    margin: 10px auto;
    padding: 10px 10px;

    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.headingSize};
    color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    flex-direction: row;

    cursor: pointer;

    > svg {
        margin: 0 10px;
    }
`;

const PlanCycle = styled.span<{selected: boolean}>`
    ${p => p.selected && css`
        text-decoration: underline;
    `}
    ${p => !p.selected && css`
        opacity: 0.7;
    `}
`;

const PricingTable = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    margin-top: 20px;
    color: ${p => p.theme.mainColor};
`;

const PricingTier = styled.section<{ highlighted?: boolean }>`
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 10px 0 rgba(0,0,0,0.1);
    border-radius: 4px;
    border: 1px solid ${p => p.theme.containerBorder};

    > * {
        padding: 10px 20px;
    }

    ${p => p.highlighted ? css`
        background-color: ${p => p.theme.mainBackground};
        color: ${p => p.theme.mainColor};

        z-index: 1;
        margin: -15px -5px -15px 0;

        > ${TierHeader} {
            padding: 37.5px 0;
        }
    ` : css`
        background-color: ${p => p.theme.mainLowlightBackground};
        opacity: 0.9;
    `}

    width: 40%;
`;

const TierHeader = styled.div`
    width: 100%;
    padding: 30px 0;
    color: ${p => p.theme.popColor};
    text-align: center;
    font-weight: bold;
    font-size: ${p => p.theme.loudHeadingSize};
`;

const TierPriceBlock = styled.div`
    text-align: center;
    padding: 15px 0;
    color: ${p => p.theme.mainColor};
    margin: 0 20px;
    border-style: solid;
    border-color: ${p => p.theme.mainColor};
    border-width: 1px 0;
`;


const TierPrice = styled.div`
    font-size: ${p => p.theme.headingSize};
    color: ${p => p.theme.mainColor};
    font-weight: bold;
`;

const TierPriceCaveats = styled.small`
    display: block;
    font-size: 80%;
    opacity: 0.8;
`;

const TierLicense = styled.div`
    display: block;
    margin-top: 10px;
    font-size: ${p => p.theme.headingSize};
`;

const TierFeatures = styled.ul`
    padding: 30px 20px;
    font-size: ${p => p.theme.textSize};

    list-style-type: circle;
`;

const FeatureHeading = styled.li`
    margin-top: 20px;
    margin-left: 0;
    list-style-type: none;

    &:first-child {
        margin-top: 0;
    }
`;

const Feature = styled.li`
    margin-top: 20px;
    margin-left: 20px;
`;

const PricingCTA = styled.div`
    margin-top: auto;
    margin-bottom: 10px;
    font-weight: bold;

    > ${Button} {
        text-align: center;
        width: 100%
    }
`;

const PlanFooter = styled.div`
    color: ${p => p.theme.mainBackground};
    font-size: ${p => p.theme.textSize};

    margin-top: 30px;
    text-align: center;

    a {
        color: ${p => p.theme.mainBackground};
        font-weight: bold;
    }

    p {
        margin-top: 10px;
    }
`;

type PlanCycle = 'monthly' | 'annual';

interface PlanPickerProps {
    email: string;
    plans: _.Dictionary<SubscriptionPlan>;
    onPlanPicked: (plan: SubscriptionPlanCode | undefined) => void;
    onLogOut: () => void;
}

@observer
export class PlanPicker extends React.Component<PlanPickerProps> {

    @observable
    planCycle: PlanCycle = 'annual';

    render() {
        const { planCycle, toggleCycle, buyPlan, closePicker, getPlanMonthlyPrice } = this;
        const { email, onLogOut } = this.props;

        return <PlanPickerModal open>
            <PlanPickerHeading>Choose your Plan</PlanPickerHeading>
            <PlanCycleToggle onClick={toggleCycle}>
                <PlanCycle selected={planCycle === 'monthly'}>Monthly</PlanCycle>

                <FontAwesomeIcon icon={['fas', planCycle === 'annual' ? 'toggle-on' : 'toggle-off']} />

                <PlanCycle selected={planCycle === 'annual'}>Annual</PlanCycle>
            </PlanCycleToggle>

            <PricingTable>
                <PricingTier highlighted={true}>
                    <TierHeader>
                        Professional
                    </TierHeader>
                    <TierPriceBlock>
                        <TierPrice>{getPlanMonthlyPrice('pro')} / month</TierPrice>
                        <TierPriceCaveats>
                            plus tax, paid {this.planCycle === 'annual' ? 'annually' : 'monthly'}
                        </TierPriceCaveats>
                        <TierLicense title='Licensed for a specific person. See the terms of service for more details.'>
                            Personal user account
                        </TierLicense>
                    </TierPriceBlock>
                    <TierFeatures>
                        <FeatureHeading>
                            <em>All free features, and:</em>
                        </FeatureHeading>
                        <Feature>
                            <strong>Integration with 1400+ APIs</strong>, including
                            AWS, Github & Stripe, for live validation and documentation
                        </Feature>
                        <Feature>
                            In-depth <strong>performance analysis</strong>, including<br/>
                            compression and caching explanations & warnings
                        </Feature>
                        <Feature>
                            <strong>Import/export traffic</strong> as HARs, or as
                            ready-to-use code for 20+ languages & tools
                        </Feature>
                        <Feature>
                            Light, dark & high-contrast UI themes
                        </Feature>
                        <Feature>
                            <strong>Support ongoing development!</strong>
                        </Feature>
                    </TierFeatures>
                    <PricingCTA>
                        <Button onClick={() => buyPlan('pro')}>
                            Get Pro Now
                        </Button>
                    </PricingCTA>
                </PricingTier>

                <PricingTier>
                    <TierHeader>
                        Team
                    </TierHeader>
                    <TierPriceBlock>
                        <TierPrice>{getPlanMonthlyPrice('team')} / user / month</TierPrice>
                        <TierPriceCaveats>
                            plus tax, paid {this.planCycle === 'annual' ? 'annually' : 'monthly'}
                        </TierPriceCaveats>
                        <TierLicense title='Licensed for many individuals, and may be transferred. See the terms of service for more details.'>
                            Team account
                        </TierLicense>
                    </TierPriceBlock>
                    <TierFeatures>
                        <FeatureHeading>
                            <em>All Professional features, and:</em>
                        </FeatureHeading>
                        <Feature>Pass licenses between team members as required</Feature>
                        <Feature>Team workspaces for low-friction collaboration</Feature>
                        <FeatureHeading>
                            Options available on request:
                        </FeatureHeading>
                        <Feature>Self-hosted infrastructure</Feature>
                        <Feature>Private support</Feature>
                        <Feature>Training & consultancy</Feature>
                        <Feature>Bulk discounts</Feature>
                    </TierFeatures>
                    <PricingCTA>
                        <ButtonLink href='mailto:contact@httptoolkit.tech?subject=HTTP Toolkit Team'>
                            Get in touch
                        </ButtonLink>
                    </PricingCTA>
                </PricingTier>
            </PricingTable>

            <CloseButton
                onClose={closePicker}
                inverted={true}
                top='5px'
                right='6px'
            />

            <PlanFooter>
                <p>
                    Logged in as { email }. <a href='#' onClick={onLogOut}>Log out</a>
                </p>
                <p>
                    By subscribing to a paid plan, you accept <a href="https://httptoolkit.tech/terms-of-service">
                        the HTTP Toolkit Terms of Service
                    </a>.
                </p>
            </PlanFooter>
        </PlanPickerModal>
    }

    @action.bound
    toggleCycle() {
        this.planCycle = this.planCycle === 'annual' ? 'monthly' : 'annual';
    }

    getPlanMonthlyPrice = (tierCode: string): string => {
        const planCode = this.getPlanCode(tierCode);
        const plan = this.props.plans[planCode];
        return plan.prices!.monthly;
    };

    getPlanCode = (tierCode: string) => {
        return `${tierCode}-${this.planCycle}` as SubscriptionPlanCode;
    }

    buyPlan = (tierCode: string) => {
        this.props.onPlanPicked(this.getPlanCode(tierCode));
    }

    closePicker = () => {
        this.props.onPlanPicked(undefined);
    }

}