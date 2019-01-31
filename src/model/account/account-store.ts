import * as _ from 'lodash';
import { get } from 'typesafe-get';
import { configure, observable, action, flow, computed, when } from 'mobx';

import { reportError } from '../../errors';
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
    user: User = getLastUserData();

    private updateUser = flow(function * (this: AccountStore) {
        this.user = yield getLatestUserData();
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
        // You could set this to true to become a paid user for free.
        // I'd rather you didn't. HTTP Toolkit takes time & love to build,
        // and I can't do that if it doesn't pay my bills!
        //
        // Fund open source - if you want pro, help pay for its development.
        // Can't afford it? Get in touch: tim@httptoolkit.tech.
        // ------------------------------------------------------------------

        // Set with the last known active subscription details
        const subscriptionExpiry = get(this, 'user', 'subscription', 'expiry');

        // If we're offline during subscription renewal, we might be outdated, so
        // leave some slack. This gives a week of offline usage. Should be enough,
        // given that most HTTP development needs network connectivity anyway.
        const expiryMargin = 1000 * 60 * 60 * 24 * 7;

        return !!subscriptionExpiry &&
            subscriptionExpiry.valueOf() + expiryMargin > Date.now();
    }

    getPro = flow(function * (this: AccountStore) {
        try {
            if (!this.isLoggedIn) {
                yield this.login();
            }

            if (!this.isLoggedIn || this.isPaidUser) return;

            const selectedPlan: SubscriptionPlanCode | undefined = yield this.pickPlan();
            if (!selectedPlan) return;

            yield this.purchasePlan(this.user.email!, selectedPlan);
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