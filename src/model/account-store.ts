import * as _ from 'lodash';
import { get } from 'typesafe-get';
import { configure, observable, action, flow, computed, when } from 'mobx';

import {
    SubscriptionPlanCode,
    SubscriptionPlans,
    getUser,
    showLoginDialog,
    openCheckout,
    logOut
} from './account';

configure({ enforceActions: 'observed' });

export class AccountStore {

    constructor() {
        this.checkForPaddle();
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

    readonly subscriptionPlans = SubscriptionPlans;

    @observable
    modal: 'login' | 'pick-a-plan' | 'checkout' | undefined;

    @observable
    private selectedPlan: SubscriptionPlanCode | undefined;

    user = getUser();

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
        const loggedIn = this.isLoggedIn || (yield this.login());

        if (!loggedIn || this.isPaidUser) return;

        const selectedPlan = yield this.pickPlan();
        if (!selectedPlan) return;

        yield this.purchasePlan(this.user.email!, selectedPlan);
    });

    login = flow(function * (this: AccountStore) {
        this.modal = 'login';

        const loggedIn = yield showLoginDialog();
        this.modal = undefined;
        return loggedIn;
    });

    @action.bound
    logOut() {
        logOut();
        this.modal = undefined;
    }

    pickPlan = flow(function * (this: AccountStore) {
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

    purchasePlan = flow(function * (this: AccountStore, email: string, planCode: string) {
        this.modal = 'checkout';

        const purchased = yield openCheckout(email, planCode);
        this.modal = undefined;
        return purchased;
    });

}