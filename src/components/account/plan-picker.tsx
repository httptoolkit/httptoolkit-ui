import * as _ from "lodash";
import * as React from "react";
import { observer } from "mobx-react";
import { observable, action, computed } from "mobx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import type { SKU, SubscriptionPlans } from "@httptoolkit/accounts";

import { styled, css } from "../../styles";
import { Icon } from "../../icons";
import { ObservablePromise } from "../../util/observable";

import { Button, UnstyledButton, ButtonLink, SecondaryButton } from "../common/inputs";
import { ModalButton } from "./modal-overlay";

const PlanPickerModal = styled.dialog`
    position: absolute;

    top: 50%;
    left: 50%;

    /* There's default styling for dialog, so undo it: */
    bottom: auto;
    right: auto;

    transform: translate(-50%, -50%);
    z-index: 9999;

    display: flex;
    flex-direction: row;
    color: ${p => p.theme.mainBackground};

    background-color: transparent;
    border: none;

    min-width: 850px;
    max-width: 980px;
    width: 90%;
`;

const PlanPickerDetails = styled.section`
    display: flex;
    flex-direction: column;
    justify-content: center;

    padding-right: 20px;
    max-width: 400px;
`;

const PlanPickerHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
    letter-spacing: -1px;
    text-align: center;
`;

const PlanCycleToggle = styled(UnstyledButton)`
    background: none;
    border: none;

    margin: 10px auto;
    padding: 10px 10px;

    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.headingSize};
    color: ${p => p.theme.mainColor};

    display: flex;
    align-items: center;
    flex-direction: row;

    > svg {
        margin: 0 10px;
        z-index: 1;
    }
`;

const PlanCycle = styled.span<{selected: boolean}>`
    padding: 10px 15px;
    border-radius: 8px;

    &:first-child {
        padding-right: 40px;
        margin-right: -40px;
    }

    &:last-child {
        padding-left: 40px;
        margin-left: -40px;
    }

    ${p => p.selected && css`
        background-color: ${p => p.theme.mainBackground};
        border-bottom: 3px solid ${p => p.theme.containerBorder};
        box-shadow: 0 4px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha/2});
    `}

    ${p => !p.selected && css`
        color: ${p => p.theme.mainBackground};
        opacity: 0.7;
    `}
`;

const PlanPickerButtons = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;

    width: 300px;
    margin: 50px auto 0;

    > p {
        margin-bottom: 10px;
        text-align: center;
        word-break: break-word;
    }
`;

const PlanSecondaryButton = styled(SecondaryButton)`
    &:not(:last-child) {
        margin-bottom: 10px;
    }

    &:not([disabled]) {
        color: ${p => p.theme.mainBackground};
        border-color: ${p => p.theme.mainBackground};
    }
`;

const Nowrap = styled.span`
    white-space: nowrap;
`;

const PricingTable = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    color: ${p => p.theme.mainColor};
    max-width: 830px;
`;

const PricingTier = styled.section<{ highlighted?: boolean }>`
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha/2});
    border-radius: 4px;
    border: 1px solid ${p => p.theme.containerBorder};

    > * {
        padding: 0 20px;
    }

    flex: 1 1;

    ${p => p.highlighted ? css`
        background-color: ${p => p.theme.mainBackground};
        color: ${p => p.theme.mainColor};

        z-index: 1;
        margin: -15px -5px -15px 0;

        flex-basis: 1%;

        > ${TierHeader} {
            padding: 37.5px 0;
        }
    ` : css`
        background-color: ${p => p.theme.mainLowlightBackground};
        opacity: 0.9;
    `}
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
    color: ${p => p.theme.mainColor};
    margin: 0 20px;
`;

const TierPrice = styled.div`
    font-size: ${p => p.theme.largeHeadingSize};
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
    padding: 40px 20px 30px;
    font-size: ${p => p.theme.textSize};
    line-height: 1.2;
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
    &:not(:first-child) {
        margin-top: 20px;
    }

    strong {
        color: ${p => p.theme.popColor};
    }
`;

const SubFeature = styled(Feature)`
    list-style: circle;
    margin-left: 20px;
`;

const SubFeatures = styled.ul`
    margin-top: 15px;

    > ${SubFeature} {
        margin-top: 4px;
    }
`;

const PricingCTA = styled.div`
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: bold;

    > ${Button} {
        text-align: center;
        width: 100%
    }
`;

const PlanSmallPrint = styled.div`
    color: ${p => p.theme.mainBackground};
    font-size: ${p => p.theme.textSize};

    margin-top: 10px;
    text-align: center;
    line-height: 1.2;

    strong {
        font-weight: bold;
    }

    a {
        color: ${p => p.theme.mainBackground};
    }

    p {
        margin-top: 10px;
    }
`;

const SpinnerModal = styled.div`
    position: absolute;

    top: 50%;
    left: 50%;

    transform: translate(-50%, -50%) scale(2);
    z-index: 99;

    display: flex;
    flex-direction: column;
    text-align: center;

    > p {
        max-width: 500px;
        line-height: 1.2;
    }

    > p, > svg {
        color: #fff;
        margin: 20px auto;
    }

    a[href] {
        color: #6e8ff4;
    }
`;

type PlanCycle = 'monthly' | 'annual';

interface PlanPickerProps {
    email?: string;
    plans: ObservablePromise<SubscriptionPlans>;
    onPlanPicked: (sku: SKU | undefined) => void;
    logOut: () => void;
    logIn: () => void;
}

@observer
export class PlanPicker extends React.Component<PlanPickerProps> {

    @observable
    planCycle: PlanCycle = 'monthly';

    render() {
        const {
            isPricingAvailable,
            planCycle,
            toggleCycle,
            buyPlan,
            closePicker,
            getPlanMonthlyPrice
        } = this;
        const { email, logOut, logIn } = this.props;

        if (!isPricingAvailable) {
            return <SpinnerModal>
                <p>
                    Unable to connect to HTTP Toolkit account servers...
                </p>
                <p>
                    Having problems? Open an issue <a
                        href="https://github.com/httptoolkit/httptoolkit/issues/new/choose"
                    >on GitHub</a> or email <strong>billing@httptoolkit.com</strong> to ask for help.
                </p>
                <Icon
                    icon={['fac', 'spinner-arc']}
                    spin
                    size='10x'
                />
                <ModalButton onClick={closePicker}>
                    Cancel
                </ModalButton>
            </SpinnerModal>
        }

        return <PlanPickerModal open>
            <PlanPickerDetails>
                <PlanPickerHeading>Choose your Plan</PlanPickerHeading>
                <PlanCycleToggle onClick={toggleCycle}>
                    <PlanCycle selected={planCycle === 'monthly'}>Monthly</PlanCycle>

                    <FontAwesomeIcon icon={['fas', planCycle === 'annual' ? 'toggle-on' : 'toggle-off']} />

                    <PlanCycle selected={planCycle === 'annual'}>Annual</PlanCycle>
                </PlanCycleToggle>

                <PlanSmallPrint>
                    <p>
                        <strong>Cancel in two clicks, anytime</strong>. <br/>Have questions? <strong><a
                            href="https://httptoolkit.com/docs/guides/subscription-faq"
                        >Read the FAQ</a></strong> or email billing@httptoolkit.com.
                    </p>
                    <p>
                        By subscribing to a paid plan, you accept <Nowrap>
                            <a href="https://httptoolkit.com/terms-of-service">
                                the HTTP Toolkit Terms of Service
                            </a>
                        </Nowrap>.
                    </p>
                </PlanSmallPrint>

                <PlanPickerButtons>
                    { email && <p>
                        Logged in as <Nowrap>{ email }</Nowrap>.
                    </p> }
                    {
                        email
                            ? <PlanSecondaryButton onClick={logOut}>Log out</PlanSecondaryButton>
                            : <PlanSecondaryButton onClick={logIn}>Log into existing account</PlanSecondaryButton>
                    }
                    <PlanSecondaryButton onClick={closePicker}>Cancel</PlanSecondaryButton>
                </PlanPickerButtons>
            </PlanPickerDetails>

            <PricingTable>
                <PricingTier highlighted={true}>
                    <TierHeader>
                        Professional
                    </TierHeader>
                    <TierPriceBlock>
                        <TierPrice>{getPlanMonthlyPrice('pro')} / month</TierPrice>
                        <TierPriceCaveats>
                            plus local tax, paid {this.planCycle === 'annual' ? 'annually' : 'monthly'}
                        </TierPriceCaveats>
                        <TierLicense title='Licensed for a specific individual. See the terms of service for full details.'>
                            Personal user account
                        </TierLicense>
                    </TierPriceBlock>
                    <TierFeatures>
                        <Feature>
                            <strong>Automated HTTP mocking & rewriting rules</strong>, including traffic redirection,
                            mock responses, and errors & timeouts.
                        </Feature>
                        <Feature>
                            <strong>Reusable Mock & Send tools</strong>. Persistent by default, plus
                            import/export so you can store, reuse & share your rules & requests.
                        </Feature>
                        <Feature>
                            <strong>Import/export for all traffic</strong> as <a
                                href="https://en.wikipedia.org/wiki/HAR_(file_format)"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                HARs
                            </a> or ready-to-use code for 20+ tools.
                        </Feature>
                        <Feature>
                            <strong>Advanced HTTP debugging tools</strong> including compression
                            & caching analysis, and 'resend' functionality.
                        </Feature>
                        <Feature>
                            <strong>Validation &amp; API documentation for 2600+ built-in APIs</strong>,
                            from AWS to GitHub to Stripe, plus your own custom <a
                                href="https://swagger.io/docs/specification/about/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >OpenAPI</a> specs.
                        </Feature>
                        <Feature>
                            <strong>Advanced customization</strong>, including UI themes,
                            whitelisted & client certificates, ports, and upstream proxies.
                        </Feature>
                        <Feature>
                            <strong>Support open-source development!</strong>
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
                            plus local tax, paid {this.planCycle === 'annual' ? 'annually' : 'monthly'}
                        </TierPriceCaveats>
                        <TierLicense title='One team license, linked to many individuals, who can be added and removed. See the terms of service for details.'>
                            Team account
                        </TierLicense>
                    </TierPriceBlock>
                    <TierFeatures>
                        <FeatureHeading>
                            <em>All Professional features, and:</em>
                        </FeatureHeading>
                        <Feature>
                            <strong>Centralized billing</strong> to simplify payment for your team
                        </Feature>
                        <Feature>Licensed to your team, rather than individuals</Feature>
                        <Feature><strong>Centralized control</strong> to easily manage your team members and subscription</Feature>
                        <Feature>
                            <strong>Team workspaces</strong> for low-friction collaboration <Nowrap>
                                (<em>coming soon</em>)
                            </Nowrap>
                        </Feature>
                        <FeatureHeading>
                            Options available on request:
                        </FeatureHeading>
                        <SubFeatures>
                            <SubFeature>Self-hosted infrastructure</SubFeature>
                            <SubFeature>Private support</SubFeature>
                            <SubFeature>Training & consultancy</SubFeature>
                            <SubFeature>Bulk discounts</SubFeature>
                        </SubFeatures>
                    </TierFeatures>
                    <PricingCTA>
                        <ButtonLink href='https://httptoolkit.com/contact'>
                            Get in touch
                        </ButtonLink>
                    </PricingCTA>
                </PricingTier>
            </PricingTable>
        </PlanPickerModal>
    }

    @action.bound
    toggleCycle() {
        this.planCycle = this.planCycle === 'annual' ? 'monthly' : 'annual';
    }

    @computed
    get isPricingAvailable() {
        const plans = this.props.plans;
        return plans.state === 'fulfilled';
    }

    getPlanMonthlyPrice = (tierCode: string): string => {
        if (!this.isPricingAvailable) throw new Error("Can't query prices if pricing is not available");
        const plans = this.props.plans.value as SubscriptionPlans; // Always true once pricing is available

        const sku = this.getSKU(tierCode);
        const plan = plans[sku];
        if (plan.prices === 'priceless') throw new Error("Can't show price for non-priced plan");
        return plan.prices!.monthly;
    };

    getSKU = (tierCode: string) => {
        return `${tierCode}-${this.planCycle}` as SKU;
    }

    buyPlan = (tierCode: string) => {
        this.props.onPlanPicked(this.getSKU(tierCode));
    }

    closePicker = () => {
        this.props.onPlanPicked(undefined);
    }

}