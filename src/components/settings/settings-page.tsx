import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from "mobx-react";
import { action, computed } from 'mobx';
import * as dedent from 'dedent';
import {
    distanceInWordsStrict, format
} from 'date-fns';
import { get } from 'typesafe-get';

import { WithInjected } from '../../types';
import { styled, Theme, ThemeName } from '../../styles';
import { WarningIcon } from '../../icons';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui-store';
import { serverVersion, versionSatisfies, PORT_RANGE_SERVER_RANGE } from '../../services/service-versions';

import { CollapsibleCard, CollapsibleCardHeading } from '../common/card';
import { ContentLabel, ContentValue } from '../common/text-content';
import { Button } from '../common/inputs';
import { TabbedOptionsContainer, Tab, TabsContainer } from '../common/tabbed-options';
import { BaseEditor } from '../editor/base-editor';

import * as amIUsingHtml from '../../amiusing.html';

import { ProxySettingsCard } from './proxy-settings-card';
import { ConnectionSettingsCard } from './connection-settings-card';
import { SettingsButton, SettingsButtonLink } from './settings-components';
import { ApiSettingsCard } from './api-settings-card';

interface SettingsPageProps {
    accountStore: AccountStore;
    uiStore: UiStore;
}

const SettingsPagePlaceholder = styled.section`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
`;

const SettingsPageScrollContainer = styled.div`
    height: 100%;
    width: 100%;
    overflow-y: auto;
`;

const SettingPageContainer = styled.section`
    margin: 0px auto 20px;
    padding: 40px;
    max-width: 800px;
    position: relative;

    * {
        transition: background-color 0.3s, margin-bottom 0.1s;
    }
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

const AccountContactFooter = styled.div`
    margin-top: 30px;

    strong {
        user-select: all;
    }
`;

const ThemeColors = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 3px solid #999;
    margin: 0 20px;
`;

const ThemeColorBlock = styled.div<{ themeColor: keyof Theme }>`
    width: 60px;
    height: 60px;
    background-color: ${p => p.theme[p.themeColor]};
`;

const EditorContainer = styled.div`
    border: 3px solid #999;
    height: 300px;
    flex-grow: 1;
`;

const cardKeys = [
    'account',
    'proxy',
    'connection',
    'themes',
    'api'
] as const;

type CardKey = typeof cardKeys[number];

@inject('accountStore')
@inject('uiStore')
@observer
class SettingsPage extends React.Component<SettingsPageProps> {

    @computed
    get cardProps() {
        return _.fromPairs(cardKeys.map((key) => [key, {
            key,
            collapsed: this.props.uiStore!.settingsCardStates[key].collapsed,
            onCollapseToggled: this.toggleCollapse.bind(this, key)
        }]));
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const { settingsCardStates } = this.props.uiStore!;
        const cardState = settingsCardStates[key];
        cardState.collapsed = !cardState.collapsed;
    }


    render() {
        const { uiStore } = this.props;
        const {
            isPaidUser,
            isPastDueUser,
            userEmail,
            userSubscription,
            subscriptionPlans,
            getPro,
            logOut
        } = this.props.accountStore;

        if (!isPaidUser && !isPastDueUser) {
            // Can only happen if you log out whilst on this page.
            return <SettingsPagePlaceholder>
                <Button onClick={() => getPro('settings-page')}>Get Pro</Button>
            </SettingsPagePlaceholder>;
        }

        // ! because we know this is set, as we have a paid user
        const sub = userSubscription!;

        return <SettingsPageScrollContainer>
            <SettingPageContainer>
                <SettingsHeading>Settings</SettingsHeading>

                <CollapsibleCard {...this.cardProps.account}>
                    <header>
                        <CollapsibleCardHeading onCollapseToggled={
                            this.cardProps.account.onCollapseToggled
                        }>
                            Account
                        </CollapsibleCardHeading>
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
                                ({
                                    'active': 'Active',
                                    'trialing': 'Active (trial)',
                                    'past_due': <strong
                                        title={dedent`
                                            Your subscription payment failed, and will be reattempted.
                                            If retried payments fail your subscription will be cancelled.
                                        `}
                                    >Past due <WarningIcon /></strong>,
                                    'deleted': 'Cancelled'
                                }[sub.status]) || 'Unknown'
                            }
                        </ContentValue>

                        <ContentLabel>
                            Subscription plan
                        </ContentLabel>
                        <ContentValue>
                            { get(subscriptionPlans, sub.plan, 'name') || 'Unknown' }
                        </ContentValue>

                        <ContentLabel>
                            {
                                ({
                                    'active': 'Next renews',
                                    'trialing': 'Renews',
                                    'past_due': 'Next payment attempt',
                                    'deleted': 'Ends',
                                }[sub.status]) || 'Current period ends'
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
                            <SettingsButtonLink
                                href={ sub.lastReceiptUrl }
                                target='_blank'
                                rel='noreferrer noopener'
                            >
                                View latest invoice
                            </SettingsButtonLink>
                        }
                        { sub.status !== 'deleted' &&
                          sub.updateBillingDetailsUrl &&
                            <SettingsButtonLink
                                href={ sub.updateBillingDetailsUrl }
                                target='_blank'
                                rel='noreferrer noopener'
                                highlight={sub.status === 'past_due'}
                            >
                                Update billing details
                            </SettingsButtonLink>
                        }
                        { sub.status !== 'deleted' &&
                          sub.cancelSubscriptionUrl &&
                            <SettingsButtonLink
                                href={ sub.cancelSubscriptionUrl }
                                target='_blank'
                                rel='noreferrer noopener'
                            >
                                Cancel subscription
                            </SettingsButtonLink>
                        }
                        <SettingsButton onClick={logOut}>Log out</SettingsButton>
                    </AccountControls>

                    <AccountContactFooter>
                        Questions? Email <strong>billing@httptoolkit.tech</strong>
                    </AccountContactFooter>
                </CollapsibleCard>


                {/*
                    This above shows for both active paid users, and recently paid users whose most recent
                    payments failed. For those users, we drop other Pro features, but keep the settings
                    UI so they can easily log out, update billing details or cancel fully.

                    The rest is active paid users only:
                 */}

                { isPaidUser && <>
                    {
                        _.isString(serverVersion.value) &&
                        versionSatisfies(serverVersion.value, PORT_RANGE_SERVER_RANGE) && <>
                            <ProxySettingsCard {...this.cardProps.proxy} />
                            <ConnectionSettingsCard {...this.cardProps.connection} />
                        </>
                    }

                    {
                        this.props.accountStore!.featureFlags.includes('openapi') &&
                        <ApiSettingsCard {...this.cardProps.api} />
                    }

                    <CollapsibleCard {...this.cardProps.themes}>
                        <header>
                            <CollapsibleCardHeading onCollapseToggled={
                                this.cardProps.themes.onCollapseToggled
                            }>
                                Themes
                            </CollapsibleCardHeading>
                        </header>
                        <TabbedOptionsContainer>
                            <TabsContainer
                                onClick={(value: ThemeName | Theme) => uiStore.setTheme(value)}
                                isSelected={(value: ThemeName | Theme) => {
                                    if (typeof value === 'string') {
                                        return uiStore.themeName === value
                                    } else {
                                        return _.isEqual(value, uiStore.theme);
                                    }
                                }}
                            >
                                <Tab
                                    icon={['fas', 'sun']}
                                    value='light'
                                >
                                    Light
                                </Tab>
                                <Tab
                                    icon={['fas', 'moon']}
                                    value='dark'
                                >
                                    Dark
                                </Tab>
                                <Tab
                                    icon={['fas', 'adjust']}
                                    value={'high-contrast'}
                                >
                                    High Contrast
                                </Tab>
                            </TabsContainer>
                            <ThemeColors>
                                <ThemeColorBlock themeColor='mainColor' />
                                <ThemeColorBlock themeColor='mainBackground' />
                                <ThemeColorBlock themeColor='highlightColor' />
                                <ThemeColorBlock themeColor='highlightBackground' />
                                <ThemeColorBlock themeColor='primaryInputColor' />
                                <ThemeColorBlock themeColor='primaryInputBackground' />
                                <ThemeColorBlock themeColor='containerWatermark' />
                                <ThemeColorBlock themeColor='containerBorder' />
                                <ThemeColorBlock themeColor='mainLowlightBackground' />
                                <ThemeColorBlock themeColor='containerBackground' />
                            </ThemeColors>

                            <EditorContainer>
                                <BaseEditor
                                    language='html'
                                    theme={uiStore.theme.monacoTheme}
                                    defaultValue={amIUsingHtml}
                                />
                            </EditorContainer>
                        </TabbedOptionsContainer>
                    </CollapsibleCard>
                </> }
            </SettingPageContainer>
        </SettingsPageScrollContainer>;
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedSettingsPage = SettingsPage as unknown as WithInjected<
    typeof SettingsPage,
    'accountStore' | 'uiStore'
>;
export { InjectedSettingsPage as SettingsPage };