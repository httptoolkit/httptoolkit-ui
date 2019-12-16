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
import * as semver from 'semver';

import { styled } from '../styles';
import { Icon } from '../icons';
import { WithInjected } from '../types';
import { trackPage } from '../tracking';
import { appHistory } from '../routing';

import { AccountStore } from '../model/account/account-store';
import { serverVersion, MOCK_SERVER_RANGE } from '../services/service-versions';

import { Sidebar, SidebarItem, SIDEBAR_WIDTH } from './sidebar';
import { InterceptPage } from './intercept/intercept-page';
import { ViewPage } from './view/view-page';
import { MockPage } from './mock/mock-page';
import { SettingsPage } from './settings/settings-page';
import { PlanPicker } from './account/plan-picker';
import { ModalOverlay } from './account/modal-overlay';

const AppContainer = styled.div<{ inert?: boolean }>`
    display: flex;
    height: 100%;

    > :not(:first-child) {
        flex: 1 1;
        width: calc(100% - ${SIDEBAR_WIDTH});
    }
`;

const Spinner = styled((p: { className?: string }) => (
    <div className={p.className}>
        <Icon
            icon={['fac', 'spinner-arc']}
            spin
            size='10x'
        />
    </div>
))`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(2);
    z-index: 100;
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

@inject('accountStore')
@observer
class App extends React.Component<{ accountStore: AccountStore }> {

    @computed
    get menuItems() {
        return [
            {
                name: 'Intercept',
                icon: ['fas', 'plug'],
                position: 'top',
                type: 'router',
                url: '/intercept'
            },
            {
                name: 'View',
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
                    semver.satisfies(serverVersion.value as string, MOCK_SERVER_RANGE)
                )
                ? [{
                    name: 'Mock',
                    icon: ['fas', 'theater-masks'],
                    position: 'top',
                    type: 'router',
                    url: '/mock'
                }]
                : []
            ),

            (this.props.accountStore.isPaidUser
                ? {
                    name: 'Settings',
                    icon: ['fas', 'cog'],
                    position: 'bottom',
                    type: 'router',
                    url: '/settings'
                }
                : {
                    name: 'Get Pro',
                    icon: ['far', 'star'],
                    position: 'bottom',
                    type: 'callback',
                    onClick: () => this.props.accountStore.getPro()
                }
            ),

            {
                name: 'Give feedback',
                icon: ['far', 'comment'],
                position: 'bottom',
                highlight: true,
                type: 'web',
                url: 'https://github.com/httptoolkit/feedback/issues/new'
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
            logOut
        } = this.props.accountStore;

        return <LocationProvider history={appHistory}>
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
                    <Route path={'/settings'} pageComponent={SettingsPage} />
                </Router>
            </AppContainer>

            { !!modal && <ModalOverlay opacity={
                // Override for checkout, as it has an independent overlay
                modal === 'checkout' ? 0.5 : undefined
            } /> }

            { modal === 'pick-a-plan' &&
                <PlanPicker
                    email={userEmail}
                    onPlanPicked={setSelectedPlan}
                    logOut={logOut}
                    logIn={logIn}
                    plans={subscriptionPlans}
                />
            }

            { modal === 'post-checkout' && <Spinner /> }
        </LocationProvider>;
    }
}

// Annoying cast required to handle the store prop nicely in our types
const AppWithStoreInjected = (
    App as unknown as WithInjected<typeof App, 'accountStore'>
);

export { AppWithStoreInjected as App };