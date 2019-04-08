import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from "mobx-react";
import { observable, action } from 'mobx';
import * as dedent from 'dedent';
import {
    distanceInWordsStrict, format
} from 'date-fns';

import { Omit, WithInjected } from '../../types';
import { styled, css } from '../../styles';
import { firstMatch } from '../../util';

import { AccountStore } from '../../model/account/account-store';

import { CollapsibleCard, CollapsibleCardProps } from '../common/card';
import { ContentLabel, ContentValue } from '../common/text-content';
import { Pill } from '../common/pill';
import { Button, ButtonLink } from '../common/inputs';

interface SettingsPageProps {
    accountStore: AccountStore;
}

type CardKey = 'request' | 'requestBody' | 'response' | 'responseBody' | 'performance';

const SettingsPagePlaceholder = styled.section`
    display: flex;
    align-items: center;
    justify-content: center;
`;

const SettingPageContainer = styled.section`
    height: 100%;
    margin: 0px auto 20px;
    padding: 40px;
    max-width: 800px;
    overflow-y: auto;
    position: relative;
`;

const SettingsHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
    margin-bottom: 40px;
`;

const AccountDetailsContainer = styled.div`
    display: grid;
    grid-template-columns: fit-content(40%) 1fr;
    grid-gap: 10px;
`;

const AccountControls = styled.div`
    margin-top: 30px;
    display: flex;
    flex-direction: row;
`;

const AccountButtonCss = css`
    font-size: ${p => p.theme.textSize};
    padding: 6px 16px;
    margin-right: 10px;
`;

const AccountButton = styled(Button)`${AccountButtonCss}`;
const AccountButtonLink = styled(ButtonLink)`${AccountButtonCss}`;

const AccountContactFooter = styled.div`
    margin-top: 30px;

    strong {
        user-select: all;
    }
`

@inject('accountStore')
@observer
class SettingsPage extends React.Component<SettingsPageProps> {

    @observable
    private cardProps = _.mapValues<{}, Omit<CollapsibleCardProps, 'children'>>({
        'account': {},
        'themes': {}
    }, (_value: { collapsed?: boolean }, key) => ({
        key: key,
        collapsed: _value.collapsed || false,
        onCollapseToggled: this.toggleCollapse.bind(this, key)
    }));

    @action.bound
    private toggleCollapse(key: CardKey) {
        const cardProps = this.cardProps[key];
        cardProps.collapsed = !cardProps.collapsed;
    }

    render() {
        const {
            isPaidUser,
            userEmail,
            userSubscription,
            subscriptionPlans,
            getPro,
            logOut
        } = this.props.accountStore;

        if (!isPaidUser) {
            // Can only happen if you log out whilst on this page.
            return <SettingsPagePlaceholder>
                <Button onClick={getPro}>Get Pro</Button>
            </SettingsPagePlaceholder>;
        }

        // ! because we know this is set, as we have a paid user
        const sub = userSubscription!;

        return <SettingPageContainer>
            <SettingsHeading>Settings</SettingsHeading>

            <CollapsibleCard {...this.cardProps.account}>
                <header>
                    <h1>Account</h1>
                </header>
                <AccountDetailsContainer>
                    <ContentLabel>
                        Account email
                    </ContentLabel>
                    <ContentValue>
                        { userEmail }
                    </ContentValue>

                    <ContentLabel>
                        Subscription status
                    </ContentLabel>
                    <ContentValue>
                        {
                            firstMatch<string | JSX.Element>(
                                [() => sub.status === 'active', 'Active'],
                                [() => sub.status === 'trialing', 'Active (trial)'],
                                [() => sub.status === 'past_due', <>
                                    Active <Pill
                                        color='#fff'
                                        title={dedent`
                                            Your subscription payment failed, and will be reattempted.
                                            If retried payments fail your subscription will be cancelled.
                                        `}
                                    >
                                        PAST DUE
                                    </Pill>
                                </>],
                                [() => sub.status === 'deleted', 'Cancelled'],
                            ) || 'Unknown'
                        }
                    </ContentValue>

                    <ContentLabel>
                        Subscription plan
                    </ContentLabel>
                    <ContentValue>
                        { subscriptionPlans[sub.plan].name }
                    </ContentValue>

                    <ContentLabel>
                        {
                            firstMatch(
                                [() => sub.status === 'active', 'Next renews'],
                                [() => sub.status === 'trialing', 'Renews'],
                                [() => sub.status === 'past_due', 'Next payment attempt'],
                                [() => sub.status === 'deleted', 'Ends'],
                            ) || 'Current period ends'
                        }
                    </ContentLabel>
                    <ContentValue>
                        {
                            distanceInWordsStrict(new Date(), sub.expiry, {
                                addSuffix: true
                            })
                        } ({
                            format(sub.expiry.toString(), 'Do [of] MMMM YYYY')
                        })
                    </ContentValue>
                </AccountDetailsContainer>

                <AccountControls>
                    { sub.lastReceiptUrl &&
                        <AccountButtonLink
                            href={ sub.lastReceiptUrl }
                            target='_blank'
                            rel='noreferrer noopener'
                        >
                            View latest invoice
                        </AccountButtonLink>
                    }
                    <AccountButtonLink
                        href={ sub.updateBillingDetailsUrl }
                        target='_blank'
                        rel='noreferrer noopener'
                    >
                        Update billing details
                    </AccountButtonLink>
                    <AccountButton onClick={logOut}>Log out</AccountButton>
                </AccountControls>

                <AccountContactFooter>
                    Questions? Email <strong>billing@httptoolkit.tech</strong>
                </AccountContactFooter>
            </CollapsibleCard>
        </SettingPageContainer>;
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedSettingsPage = SettingsPage as unknown as WithInjected<
    typeof SettingsPage,
    'accountStore'
>;
export { InjectedSettingsPage as SettingsPage };