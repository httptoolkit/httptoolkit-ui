import * as _ from 'lodash';
import { get } from 'typesafe-get';
import { configure, observable, action, flow, computed, when } from 'mobx';

import { reportError } from '../../errors';
import { trackEvent } from '../../tracking';
import { delay } from '../../util';

import {
    loginEvents,
    showLoginDialog,
    logOut,
    User,
    getLatestUserData,
    getLastUserData
} from './auth';
import {
    SubscriptionPlans,
    SubscriptionPlanCode,
    openCheckout
} from './subscriptions';

configure({ enforceActions: 'observed' });

export class AccountStore {

    constructor() {
        this.checkForPaddle();

        // Update account data automatically on login, logout & every 10 mins
        loginEvents.on('authenticated', async () => {
            await this.updateUser();
            loginEvents.emit('user_data_loaded');
        });
        loginEvents.on('logout', this.updateUser);
        setInterval(this.updateUser, 1000 * 60 * 10);
        this.updateUser();
    }

    @action.bound
    private checkForPaddle() {
        this.paddleLoaded = !!(window as any).Paddle;

        if (!this.paddleLoaded) {
            setTimeout(this.checkForPaddle, 500);
        }
    }

    @observable
    private paddleLoaded: boolean = false;

    @observable
    private user: User = getLastUserData();

    @observable
    accountDataLastUpdated = 0;

    @computed get userEmail() {
        return this.user.email;
    }

    @computed get userSubscription() {
        return this.isPaidUser
            ? this.user.subscription
            : undefined;
    }

    private updateUser = flow(function * (this: AccountStore) {
        this.user = yield getLatestUserData();
        this.accountDataLastUpdated = Date.now();
    }.bind(this));

    readonly subscriptionPlans = SubscriptionPlans;

    @observable
    modal: 'login' | 'pick-a-plan' | 'checkout' | 'post-checkout' | undefined;

    @observable
    private selectedPlan: SubscriptionPlanCode | undefined;

    @computed get isLoggedIn() {
        return !!this.user.email;
    }

    @computed get isPaidUser() {
        // ------------------------------------------------------------------
        // You could set this to true to become a paid user for free.
        // I'd rather you didn't. HTTP Toolkit takes time & love to build,
        // and I can't do that if it doesn't pay my bills!
        //
        // Fund open source - if you want pro, help pay for its development.
        // Can't afford it? Get in touch: tim@httptoolkit.tech.
        // ------------------------------------------------------------------

        // Set with the last known subscription details
        const subscriptionExpiry = get(this.user.subscription, 'expiry');
        const subscriptionStatus = get(this.user.subscription, 'status');

        // If we're offline during subscription renewal, and the sub was active last
        // we checked, then we might just have outdated data, so leave some slack.
        // This gives a week of offline usage. Should be enough, given that most HTTP
        // development needs network connectivity anyway.
        const expiryMargin = subscriptionStatus === 'active'
            ? 1000 * 60 * 60 * 24 * 7
            : 0;

        return !!subscriptionExpiry &&
            subscriptionExpiry.valueOf() + expiryMargin > Date.now();
    }

    getPro = flow(function * (this: AccountStore) {
        try {
            trackEvent({ category: 'Account', action: 'Get Pro' });
            if (!this.isLoggedIn) {
                yield this.login();

                if (!this.isLoggedIn) {
                    trackEvent({ category: 'Account', action: 'Login failed' });
                    return;
                }

                trackEvent({ category: 'Account', action: 'Login success' });
            }

            if (this.isPaidUser) {
                trackEvent({ category: 'Account', action: 'Paid user login' });
                return;
            }

            const selectedPlan: SubscriptionPlanCode | undefined = yield this.pickPlan();
            if (!selectedPlan) {
                trackEvent({ category: 'Account', action: 'Plans rejected' });
                return;
            }
            trackEvent({ category: 'Account', action: 'Plan selected', label: selectedPlan });

            const purchased = yield this.purchasePlan(this.user.email!, selectedPlan);

            if (purchased) {
                trackEvent({ category: 'Account', action: 'Checkout complete', label: selectedPlan });
            } else {
                trackEvent({ category: 'Account', action: 'Checkout cancelled', label: selectedPlan });
            }
        } catch (error) {
            reportError(error);
            this.modal = undefined;
        }
    }.bind(this));

    private login = flow(function * (this: AccountStore) {
        this.modal = 'login';

        const loggedIn: boolean = yield showLoginDialog();
        this.modal = undefined;
        return loggedIn;
    });

    @action.bound
    logOut() {
        logOut();
        this.modal = undefined;
    }

    private pickPlan = flow(function * (this: AccountStore) {
        this.modal = 'pick-a-plan';

        yield when(() => this.modal !== 'pick-a-plan' || !!this.selectedPlan);

        const selectedPlan = this.selectedPlan;
        this.selectedPlan = undefined;
        this.modal = undefined;

        return selectedPlan;
    });

    @action.bound
    setSelectedPlan(plan: SubscriptionPlanCode | undefined) {
        if (plan) {
            this.selectedPlan = plan;
        } else {
            this.selectedPlan = this.modal = undefined;
        }
    }

    private purchasePlan = flow(function * (this: AccountStore, email: string, planCode: SubscriptionPlanCode) {
        this.modal = 'checkout';

        const purchased: boolean = yield openCheckout(email, planCode);

        if (purchased) {
            this.modal = 'post-checkout';

            yield this.updateUser();
            let retries = 30;
            while (!this.isPaidUser && retries > 0) {
                retries -= 1;
                yield delay(1000);
                yield this.updateUser();
            }

            // After 30 seconds, fail - this will report an error, show an error, and then refresh
            if (!this.isPaidUser) throw new Error('Checkout failed to complete!');
        }

        this.modal = undefined;
        return purchased;
    });

}