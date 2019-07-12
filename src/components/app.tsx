import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../styles';
import { WithInjected } from '../types';
import { trackPage } from '../tracking';
import { AccountStore } from '../model/account/account-store';

import { Sidebar, SidebarItem } from './sidebar';
import { InterceptPage } from './intercept/intercept-page';
import { ViewPage } from './view/view-page';
import { MockPage } from './mock/mock-page';
import { SettingsPage } from './settings/settings-page';

import { PlanPicker } from './account/plan-picker';
import { ModalOverlay } from './account/modal-overlay';
import { FontAwesomeIcon } from '../icons';

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

type Page = typeof InterceptPage | typeof ViewPage | typeof SettingsPage;

@inject('accountStore')
@observer
class App extends React.Component<{ accountStore: AccountStore }> {

    @observable.ref selectedPage: Page = InterceptPage;

    @computed
    get menuItems() {
        return [
            {
                name: 'Intercept',
                icon: ['fas', 'plug'],
                position: 'top',
                page: InterceptPage
            },
            {
                name: 'View',
                icon: ['fas', 'search'],
                position: 'top',
                page: ViewPage
            },
            {
                name: 'Mock',
                icon: ['fas', 'theater-masks'],
                position: 'top',
                page: MockPage
            },

            this.props.accountStore.isPaidUser
                ? {
                    name: 'Settings',
                    icon: ['fas', 'cog'],
                    position: 'bottom',
                    page: SettingsPage
                }
                : {
                    name: 'Get Pro',
                    icon: ['far', 'star'],
                    position: 'bottom',
                    onSelected: () => this.props.accountStore.getPro()
                }
        ];
    }

    render() {
        const {
            modal,
            setSelectedPlan,
            subscriptionPlans,
            userEmail,
            logOut
        } = this.props.accountStore;

        const PageComponent = this.selectedPage;
        const selectedPageIndex = _.findIndex(this.menuItems, (i) => i.page === PageComponent);

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
                    items={(this.menuItems as SidebarItem[]).concat({
                        name: 'Give feedback',
                        icon: ['far', 'comment'],
                        position: 'bottom',
                        highlight: true,
                        url: 'https://github.com/httptoolkit/feedback/issues/new'
                    })}
                    selectedItemIndex={selectedPageIndex}
                    onSelectItem={this.onSelectItem}
                />
                <PageComponent />
            </AppContainer>

            { !!modal && <ModalOverlay opacity={
                // Override for checkout, as it has an independent overlay
                modal === 'checkout' ? 0.5 : undefined
            } /> }

            { modal === 'pick-a-plan' &&
                <PlanPicker
                    email={userEmail!}
                    onPlanPicked={setSelectedPlan}
                    onLogOut={logOut}
                    plans={subscriptionPlans}
                />
            }

            { modal === 'post-checkout' && <Spinner /> }
        </>;
    }

    @action.bound
    onSelectItem(selectedItemIndex: number) {
        const selectedItem = this.menuItems[selectedItemIndex];

        if (selectedItem.onSelected) {
            selectedItem.onSelected();
        } else if (selectedItem.page) {
            this.selectedPage = selectedItem.page;
            trackPage(selectedItem.name);
        }
    }
}

// Annoying cast required to handle the store prop nicely in our types
const AppWithStoreInjected = (
    App as unknown as WithInjected<typeof App, 'accountStore'>
);

export { AppWithStoreInjected as App };