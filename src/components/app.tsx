import * as _ from 'lodash';
import * as React from 'react';
import { computed } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';
import {
    Router,
    RouteComponentProps,
    Redirect,
    LocationProvider
} from '@reach/router';

import { styled } from '../styles';
import { WithInjected } from '../types';
import { trackPage } from '../tracking';
import { appHistory } from '../routing';
import { useHotkeys, Ctrl } from '../util/ui';

import { AccountStore } from '../model/account/account-store';
import { serverVersion, versionSatisfies, MOCK_SERVER_RANGE } from '../services/service-versions';

import { Sidebar, SidebarItem, SIDEBAR_WIDTH } from './sidebar';
import { InterceptPage } from './intercept/intercept-page';
import { ViewPage } from './view/view-page';
import { MockPage } from './mock/mock-page';
import { SettingsPage } from './settings/settings-page';
import { PlanPicker } from './account/plan-picker';
import { ModalOverlay } from './account/modal-overlay';
import { CheckoutSpinner } from './account/checkout-spinner';

const AppContainer = styled.div<{ inert?: boolean }>`
    display: flex;
    height: 100%;

    > :not(:first-child) {
        flex: 1 1;
        width: calc(100% - ${SIDEBAR_WIDTH});
    }
`;

interface ExtendProps extends React.PropsWithChildren<any> {
	pageComponent: React.ComponentType<{}>;
}

const Route = ({ children, ...props }: ExtendProps & RouteComponentProps): React.ReactElement => {
	const { pageComponent, ...otherProps } = props;
	return (
		<props.pageComponent {...otherProps}>
			{children}
		</props.pageComponent>
	)
};

const AppKeyboardShortcuts = (props: {
    navigate: (path: string) => void,
    canVisitSettings: boolean
}) => {
    useHotkeys('Ctrl+1,Cmd+1', (e) => {
        props.navigate('/intercept');
        e.preventDefault();
    }, [props.navigate]);
    useHotkeys('Ctrl+2,Cmd+2', (e) => {
        props.navigate('/view');
        e.preventDefault();
    }, [props.navigate]);
    useHotkeys('Ctrl+3,Cmd+3', (e) => {
        props.navigate('/mock');
        e.preventDefault();
    }, [props.navigate]);
    useHotkeys('Ctrl+9,Cmd+9', (e) => {
        if (props.canVisitSettings) props.navigate('/settings');
        e.preventDefault();
    }, [props.navigate, props.canVisitSettings]);

    return null;
};

@inject('accountStore')
@observer
class App extends React.Component<{ accountStore: AccountStore }> {

    @computed
    get canVisitSettings() {
        return this.props.accountStore.isPaidUser || this.props.accountStore.isPastDueUser;
    }

    @computed
    get menuItems() {
        return [
            {
                name: 'Intercept',
                title: `Connect clients to HTTP Toolkit (${Ctrl}+1)`,
                icon: ['fas', 'plug'],
                position: 'top',
                type: 'router',
                url: '/intercept'
            },
            {
                name: 'View',
                title: `View intercepted HTTP traffic (${Ctrl}+2)`,
                icon: ['fas', 'search'],
                position: 'top',
                type: 'router',
                url: '/view'
            },

            ...(
                (
                    // Hide Mock option if the server is too old for proper support.
                    // We show by default to avoid flicker in the most common case
                    serverVersion.state !== 'fulfilled' ||
                    versionSatisfies(serverVersion.value as string, MOCK_SERVER_RANGE)
                )
                ? [{
                    name: 'Mock',
                    title: `Add rules to mock & rewrite HTTP traffic (${Ctrl}+3)`,
                    icon: ['fas', 'theater-masks'],
                    position: 'top',
                    type: 'router',
                    url: '/mock'
                }]
                : []
            ),

            (this.canVisitSettings
                ? {
                    name: 'Settings',
                    title: `Reconfigure HTTP Toolkit and manage your account (${Ctrl}+9)`,
                    icon: ['fas', 'cog'],
                    position: 'bottom',
                    type: 'router',
                    url: '/settings'
                }
                : {
                    name: 'Get Pro',
                    title: "Sign up for HTTP Toolkit Pro",
                    icon: ['far', 'star'],
                    position: 'bottom',
                    type: 'callback',
                    onClick: () => this.props.accountStore.getPro('sidebar')
                }
            ),

            {
                name: 'Give feedback',
                title: "Suggest features or report issues",
                icon: ['far', 'comment'],
                position: 'bottom',
                highlight: true,
                type: 'web',
                url: 'https://github.com/httptoolkit/httptoolkit/issues/new/choose'
            }
        ] as SidebarItem[];
    }

    componentDidMount() {
        disposeOnUnmount(this, appHistory.listen(
            ({ location }) => trackPage(location)
        ));
    }

    render() {
        const {
            modal,
            setSelectedPlan,
            subscriptionPlans,
            userEmail,
            logIn,
            logOut,
            cancelCheckout
        } = this.props.accountStore;

        return <LocationProvider history={appHistory}>
            <AppKeyboardShortcuts
                navigate={appHistory.navigate}
                canVisitSettings={this.canVisitSettings}
            />
            <AppContainer
                aria-hidden={!!modal}
                inert={!!modal}
                // 'inert' doesn't actually work - it's non-standard, so we need this:
                ref={node => node && (!!modal ?
                    node.setAttribute('inert', '') : node.removeAttribute('inert')
                )}
            >
                <Sidebar items={this.menuItems} />

                <Router>
                    <Redirect noThrow from="/" to={'/intercept'} />
                    <Route path={'/intercept'} pageComponent={InterceptPage} />
                    <Route path={'/view'} pageComponent={ViewPage} />
                    <Route path={'/view/:eventId'} pageComponent={ViewPage} />
                    <Route path={'/mock'} pageComponent={MockPage} />
                    <Route path={'/mock/:initialRuleId'} pageComponent={MockPage} />
                    <Route path={'/settings'} pageComponent={SettingsPage} />
                </Router>
            </AppContainer>

            { !!modal && <ModalOverlay /> }

            { modal === 'pick-a-plan' &&
                <PlanPicker
                    email={userEmail}
                    onPlanPicked={setSelectedPlan}
                    logOut={logOut}
                    logIn={logIn}
                    plans={subscriptionPlans}
                />
            }

            { modal === 'post-checkout' &&
                <CheckoutSpinner
                    onCancel={cancelCheckout}
                />
            }
        </LocationProvider>;
    }
}

// Annoying cast required to handle the store prop nicely in our types
const AppWithStoreInjected = (
    App as unknown as WithInjected<typeof App, 'accountStore'>
);

export { AppWithStoreInjected as App };