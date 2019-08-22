import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from "mobx-react";
import { observable, action, computed } from 'mobx';
import * as dedent from 'dedent';
import {
    distanceInWordsStrict, format
} from 'date-fns';
import { get } from 'typesafe-get';
import * as semver from 'semver';

import { Omit, WithInjected } from '../../types';
import { styled, css, Theme, ThemeName } from '../../styles';
import { WarningIcon, FontAwesomeIcon } from '../../icons';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui-store';
import { InterceptionStore, isValidPortConfiguration } from '../../model/interception-store';
import { serverVersion, PORT_RANGE_SERVER_RANGE } from '../../services/service-versions';

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
    interceptionStore: InterceptionStore;
}

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

const SettingsButtonCss = css`
    font-size: ${p => p.theme.textSize};
    padding: 6px 16px;
    margin-right: 10px;
`;

const SettingsButton = styled(Button)`${SettingsButtonCss}`;
const SettingsButtonLink = styled(ButtonLink)`${SettingsButtonCss}`;

const AccountContactFooter = styled.div`
    margin-top: 30px;

    strong {
        user-select: all;
    }
`;

const RestartApp = styled(SettingsButton).attrs(() => ({
    children: 'Restart app to activate',
    onClick: () => window.location.reload()
}))`
    position: absolute;
    top: 18px;
    left: 20px;
    font-weight: bold;

    ${(p: { visible: boolean }) => !p.visible && 'display: none;'}
`;

const CertificateWhitelistList = styled.div`
    display: grid;
    grid-template-columns: min-content min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    input {
        align-self: stretch;
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
    }
`;

const WhitelistHost = styled.div`
    min-width: 300px;
    font-family: ${p => p.theme.monoFontFamily};

    ${(p: { active: boolean }) => !p.active && css`
        font-style: italic;
        opacity: 0.6;
    `}
`;

const ProxyPortsContainer = styled.div`
    display: grid;
    grid-template-columns: fit-content(45%) fit-content(45%) fit-content(10%);
    align-items: baseline;

    grid-gap: 10px;
    margin: 40px 0 10px 0;

    input {
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};

        & + ${WarningIcon} {
            visibility: hidden;
            align-self: center;
        }

        &:invalid {
            border-color: #f1971f;
            background-color: #f1971f40;
            color: ${p => p.theme.mainColor};

            & + ${WarningIcon} {
                visibility: visible;
            }
        }
    }
`;

const ProxyPortStateExplanation = styled.p`
    margin-bottom: 10px;
`;

const SettingsExplanation = styled.p`
    font-style: italic;
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

@inject('accountStore')
@inject('uiStore')
@inject('interceptionStore')
@observer
class SettingsPage extends React.Component<SettingsPageProps> {

    @observable
    private cardProps = _.mapValues<{}, Omit<CollapsibleCardProps, 'children'>>({
        'account': {},
        'proxy': {},
        'themes': {}
    }, (_value: { collapsed?: boolean }, key) => ({
        key: key,
        collapsed: _value.collapsed || false,
        onCollapseToggled: this.toggleCollapse.bind(this, key)
    }));

    @action.bound
    private toggleCollapse(key: string) {
        const cardProps = this.cardProps[key];
        cardProps.collapsed = !cardProps.collapsed;
    }

    @observable
    whitelistHostInput = '';

    @action.bound
    unwhitelistHost(host: string) {
        const { whitelistedCertificateHosts } = this.props.interceptionStore!;
        const hostIndex = whitelistedCertificateHosts.indexOf(host);
        if (hostIndex > -1) {
            whitelistedCertificateHosts.splice(hostIndex, 1);
        }
    }

    @action.bound
    addHostToWhitelist() {
        this.props.interceptionStore!.whitelistedCertificateHosts.push(this.whitelistHostInput);
        this.whitelistHostInput = '';
    }

    @observable
    minPortValue = (get(this.props.interceptionStore.portConfig, 'startPort') || 8000).toString();

    @observable
    maxPortValue = (get(this.props.interceptionStore.portConfig, 'endPort') || 65535).toString();

    @action.bound
    onMinPortChange({ target: { value } }: React.ChangeEvent<HTMLInputElement>) {
        this.minPortValue = value;
        this.updatePortConfig();
    }

    @action.bound
    onMaxPortChange({ target: { value } }: React.ChangeEvent<HTMLInputElement>) {
        this.maxPortValue = value;
        this.updatePortConfig();
    }

    @computed
    get isCurrentPortInRange() {
        const { serverPort, portConfig } = this.props.interceptionStore;

        if (!portConfig) {
            return serverPort >= 8000;
        } else {
            return serverPort >= portConfig.startPort && serverPort <= portConfig.endPort;
        }
    }

    @computed
    get portConfig() {
        return {
            startPort: parseInt(this.minPortValue, 10),
            endPort: parseInt(this.maxPortValue, 10)
        };
    }

    @computed
    get isCurrentPortConfigValid() {
        return isValidPortConfiguration(this.portConfig);
    }

    updatePortConfig() {
        if (!this.isCurrentPortConfigValid) return;
        else this.props.interceptionStore.setPortConfig(this.portConfig);
    }

    render() {
        const { uiStore } = this.props;
        const {
            serverPort,
            whitelistedCertificateHosts,
            initiallyWhitelistedCertificateHosts
        } = this.props.interceptionStore;
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
                        <SettingsButtonLink
                            href={ sub.updateBillingDetailsUrl }
                            target='_blank'
                            rel='noreferrer noopener'
                        >
                            Update billing details
                        </SettingsButtonLink>
                        <SettingsButton onClick={logOut}>Log out</SettingsButton>
                    </AccountControls>

                    <AccountContactFooter>
                        Questions? Email <strong>billing@httptoolkit.tech</strong>
                    </AccountContactFooter>
                </CollapsibleCard>

                {
                    _.isString(serverVersion.value) &&
                    semver.satisfies(serverVersion.value, PORT_RANGE_SERVER_RANGE) &&
                    <CollapsibleCard {...this.cardProps.proxy}>
                        <header>
                            <h1>Proxy settings</h1>
                        </header>
                        <RestartApp
                            visible={
                                (this.isCurrentPortConfigValid && !this.isCurrentPortInRange) ||
                                !_.isEqual(whitelistedCertificateHosts, initiallyWhitelistedCertificateHosts)
                            }
                        />
                        <ContentLabel>
                            Host Certificate Whitelist
                        </ContentLabel>
                        <CertificateWhitelistList>
                            {  whitelistedCertificateHosts.map((host) => [
                                <WhitelistHost
                                    active={initiallyWhitelistedCertificateHosts.includes(host)}
                                    key={`host-${host}`}
                                >{ host }</WhitelistHost>,
                                <SettingsButton
                                    key={`delete-${host}`}
                                    onClick={() => this.unwhitelistHost(host)}
                                >
                                    <FontAwesomeIcon icon={['far', 'trash-alt']} />
                                </SettingsButton>
                            ]) }

                            <input
                                type="text"
                                required
                                placeholder='Hostname to whitelist for certificate checks'
                                value={this.whitelistHostInput}
                                onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                                    this.whitelistHostInput = e.target.value;
                                })}
                            />
                            <SettingsButton
                                disabled={
                                    !this.whitelistHostInput ||
                                    whitelistedCertificateHosts.includes(this.whitelistHostInput)
                                }
                                onClick={this.addHostToWhitelist}
                            >
                                <FontAwesomeIcon icon={['fas', 'plus']} />
                            </SettingsButton>
                        </CertificateWhitelistList>
                        <SettingsExplanation>
                            All requests to these hosts will skip certificate validation, and so will
                            appear successful despite self-signed, expired or invalid HTTPS certificates.
                        </SettingsExplanation>

                        <ProxyPortsContainer>
                            <ContentLabel>
                                Minimum port
                            </ContentLabel>
                            <input
                                type="number"
                                required
                                min="1"
                                max="65535"
                                value={this.minPortValue}
                                onChange={this.onMinPortChange}
                            />
                            <WarningIcon />

                            <ContentLabel>
                                Maximum port
                            </ContentLabel>
                            <input
                                type="number"
                                required
                                min={this.minPortValue}
                                max="65535"
                                value={this.maxPortValue}
                                onChange={this.onMaxPortChange}
                            />
                            <WarningIcon />
                        </ProxyPortsContainer>
                        <ProxyPortStateExplanation>
                            The proxy is currently using port <strong>
                                { serverPort }
                            </strong>{
                                (this.isCurrentPortConfigValid && !this.isCurrentPortInRange)
                                ? ', outside this range. Restart the app now to use this configuration.'
                                : '.'
                            }
                        </ProxyPortStateExplanation>
                        <SettingsExplanation>
                            When opening HTTP Toolkit, it will start the proxy on the first port in
                            this range that is available. If all ports in the range are in use, the
                            first free port above 8000 will be used instead.
                        </SettingsExplanation>
                    </CollapsibleCard>
                }

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
    'accountStore' | 'uiStore' | 'interceptionStore'
>;
export { InjectedSettingsPage as SettingsPage };