import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from "mobx-react";
import { observable, action } from 'mobx';
import * as dedent from 'dedent';
import {
    distanceInWordsStrict, format
} from 'date-fns';

import { Omit, WithInjected } from '../../types';
import { styled, css, Theme, ThemeName } from '../../styles';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui-store';

import { CollapsibleCard, CollapsibleCardProps } from '../common/card';
import { ContentLabel, ContentValue } from '../common/text-content';
import { Pill } from '../common/pill';
import { Button, ButtonLink } from '../common/inputs';
import { TabbedOptionsContainer, Tab, TabsContainer } from '../common/tabbed-options';
import { BaseEditor } from '../editor/base-editor';

import * as amIUsingHtml from '../../amiusing.html';

interface SettingsPageProps {
    accountStore: AccountStore;
    uiStore: UiStore;
}

type CardKey = 'request' | 'requestBody' | 'response' | 'responseBody' | 'performance';

const SettingsPagePlaceholder = styled.section`
    display: flex;
    align-items: center;
    justify-content: center;
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

@inject('accountStore')
@inject('uiStore')
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
        const { uiStore } = this.props;
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

        return <SettingsPageScrollContainer>
            <SettingPageContainer>
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
                                ({
                                    'active': 'Active',
                                    'trialing': 'Active (trial)',
                                    'past_due': <>
                                        Active <Pill
                                            color='#fff'
                                            title={dedent`
                                                Your subscription payment failed, and will be reattempted.
                                                If retried payments fail your subscription will be cancelled.
                                            `}
                                        >
                                            PAST DUE
                                        </Pill>
                                    </>,
                                    'deleted': 'Cancelled'
                                }[sub.status]) || 'Unknown'
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

                <CollapsibleCard {...this.cardProps.themes}>
                    <header>
                        <h1>Themes</h1>
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