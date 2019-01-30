import * as React from 'react';
import { observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../styles';
import { WithInjected } from '../types';
import { trackPage } from '../tracking';
import { AccountStore } from '../model/account/account-store';

import { Sidebar } from './sidebar';
import { InterceptPage } from './intercept/intercept-page';
import { ViewPage } from './view/view-page';

import { PlanPicker } from './account/plan-picker';
import { ModalOverlay } from './account/modal-overlay';
import { FontAwesomeIcon } from '../icons';

const PAGES = [
    { name: 'Intercept', icon: ['fas', 'plug'], component: InterceptPage },
    { name: 'View', icon: ['fas', 'search'], component: ViewPage }
];

const AppContainer = styled.div<{ inert?: boolean }>`
    display: flex;
    height: 100%;

    > :not(:first-child) {
        flex: 1 1;
    }
`;

const Spinner = styled((p: { className?: string }) => (
    <div className={p.className}>
        <FontAwesomeIcon
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

@inject('accountStore')
@observer
class App extends React.Component<{ accountStore: AccountStore }> {

    @observable selectedPageIndex: number = 0;

    render() {
        const { modal, setSelectedPlan, subscriptionPlans, user, logOut } = this.props.accountStore;
        const PageComponent = PAGES[this.selectedPageIndex].component;

        return <>
            <AppContainer
                aria-hidden={!!modal}
                inert={!!modal}
                // 'inert' doesn't actually work - it's non-standard, so we need this:
                ref={node => node && (!!modal ?
                    node.setAttribute('inert', '') : node.removeAttribute('inert')
                )}
            >
                <Sidebar
                    pages={PAGES}
                    selectedPageIndex={this.selectedPageIndex}
                    onSelectPage={this.onSelectPage}
                />
                <PageComponent />
            </AppContainer>

            { !!modal && <ModalOverlay opacity={
                modal === 'checkout' ? 0.5 : undefined // Override for checkout, as it has an independent overlay
            } /> }

            { modal === 'pick-a-plan' &&
                <PlanPicker
                    email={user.email!}
                    onPlanPicked={setSelectedPlan}
                    onLogOut={logOut}
                    plans={subscriptionPlans}
                />
            }

            { modal === 'post-checkout' && <Spinner /> }
        </>;
    }

    @action.bound
    onSelectPage(selectedPageIndex: number) {
        this.selectedPageIndex = selectedPageIndex;
        trackPage(PAGES[selectedPageIndex].name);
    }
}

// Annoying cast required to handle the store prop nicely in our types
const AppWithStoreInjected = (
    App as unknown as WithInjected<typeof App, 'accountStore'>
);

export { AppWithStoreInjected as App };