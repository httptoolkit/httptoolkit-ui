import * as _ from 'lodash';
import { observable, action, flow, computed, when } from 'mobx';

import { reportError, reportErrorsAsUser } from '../../errors';
import { trackEvent } from '../../tracking';
import { delay } from '../../util/promise';
import { lazyObservablePromise } from '../../util/observable';

import {
    loginEvents,
    showLoginDialog,
    logOut,
    User,
    getLatestUserData,
    getLastUserData,
    RefreshRejectedError
} from './auth';
import {
    SubscriptionPlans,
    SubscriptionPlanCode,
    openCheckout
} from './subscriptions';

export class AccountStore {

    constructor(
        private goToSettings: () => void
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        // Update account data automatically on login, logout & every 10 mins
        loginEvents.on('authenticated', async () => {
            await this.updateUser();
            loginEvents.emit('user_data_loaded');
        });
        loginEvents.on('authorization_error', (error) => {
            if (error instanceof RefreshRejectedError) {
                // If our refresh token ever becomes invalid (caused once by an Auth0 regression,
                // or in general refresh tokens can be revoked), prompt for a fresh login.
                logOut();
                this.logIn();
            }
        });
        loginEvents.on('logout', this.updateUser);
        setInterval(this.updateUser, 1000 * 60 * 10);
        this.updateUser();

        console.log('Account store created');
    });

    @observable
    private user: User = getLastUserData();

    @observable
    accountDataLastUpdated = 0;

    @computed get userEmail() {
        return this.user.email;
    }

    @computed get userSubscription() {
        return this.isPaidUser || this.isPastDueUser
            ? this.user.subscription
            : undefined;
    }

    private updateUser = flow(function * (this: AccountStore) {
        this.user = yield getLatestUserData();
        this.accountDataLastUpdated = Date.now();

        // Include the user email in error reports whilst they're logged in.
        // Useful generally, but especially for checkout/subscription issues.
        reportErrorsAsUser(this.user.email);

        if (this.user.banned) {
            alert('Your account has been blocked for abuse. Please contact help@httptoolkit.tech.');
            window.close();
        }
    }.bind(this));

    readonly subscriptionPlans = SubscriptionPlans;

    @observable
    modal: 'login' | 'pick-a-plan' | 'post-checkout' | undefined;

    @observable
    private selectedPlan: SubscriptionPlanCode | undefined;

    @computed get isLoggedIn() {
        return !!this.user.email;
    }

    @computed get featureFlags() {
        return _.clone(this.user.featureFlags);
    }

    @computed private get isStatusUnexpired() {
        const subscriptionExpiry = this.user.subscription?.expiry;
        const subscriptionStatus = this.user.subscription?.status;

        const expiryMargin = subscriptionStatus === 'active'
            // If we're offline during subscription renewal, and the sub was active last
            // we checked, then we might just have outdated data, so leave extra slack.
            // This gives a week of offline usage. Should be enough, given that most HTTP
            // development needs network connectivity anyway.
            ? 1000 * 60 * 60 * 24 * 7
            : 0;

        return !!subscriptionExpiry &&
            subscriptionExpiry.valueOf() + expiryMargin > Date.now();
    }

    @computed get isPaidUser() {
        // ------------------------------------------------------------------
        // You could set this to true to become a paid user for free.
        // I'd rather you didn't. HTTP Toolkit takes time & love to build,
        // and I can't do that if it doesn't pay my bills!
        //
        // Fund open source - if you want Pro, help pay for its development.
        // Can't afford it? Get in touch: tim@httptoolkit.tech.
        // ------------------------------------------------------------------

        // If you're before the last expiry date, your subscription is valid,
        // unless it's past_due, in which case you're in a strange ambiguous
        // zone, and the expiry date is the next retry. In that case, your
        // status is unexpired, but _not_ considered as valid for Pro features.
        // Note that explicitly cancelled ('deleted') subscriptions are still
        // valid until the end of the last paid period though!
        return this.user.subscription?.status !== 'past_due' &&
            this.isStatusUnexpired;
    }

    @computed get isPastDueUser() {
        // Is the user a subscribed user whose payments are failing? Keep them
        // in an intermediate state so they can fix it (for now, until payment
        // retries fail, and their subscription cancels & expires completely).
        return this.user.subscription?.status === 'past_due' &&
            this.isStatusUnexpired;
    }

    @computed get userHasSubscription() {
        return this.isPaidUser || this.isPastDueUser;
    }

    @computed get mightBePaidUser() {
        // Like isPaidUser, but returns true for users who have subscription data
        // locally that's expired, until we successfully make a first check.
        return this.user.subscription?.status &&
            this.user.subscription?.status !== 'past_due' &&
            (this.isStatusUnexpired || this.accountDataLastUpdated === 0);
    }

    getPro = flow(function * (this: AccountStore, source: string) {
        try {
            trackEvent({ category: 'Account', action: 'Get Pro', label: source });

            const selectedPlan: SubscriptionPlanCode | undefined = yield this.pickPlan();
            if (!selectedPlan) return;

            if (!this.isLoggedIn) yield this.logIn();

            // If we cancelled login, or we've already got a plan, we're done.
            if (!this.isLoggedIn || this.userHasSubscription) {
                if (this.isPastDueUser) this.goToSettings();
                return;
            }

            const isRiskyPayment = this.subscriptionPlans[selectedPlan].prices?.currency === 'BRL' &&
                this.userEmail?.endsWith('@gmail.com'); // So far, all chargebacks have been from gmail accounts

            const newUser = !this.user.subscription; // Even cancelled users will have an expired subscription left
            if (newUser && isRiskyPayment) {
                // This is annoying, I wish we didn't have to do this, but fraudulent BRL payments are now 80% of chargebacks,
                // and we need to tighten this up and block that somehow or payment platforms will eventually block
                // HTTP Toolkit globally. This error message is left intentionally vague to try and discourage fraudsters
                // from using a VPN to work around it. We do still allow this for existing customers, who are already
                // logged in - we're attempting to just block the creation of new accounts here.

                trackEvent({ category: 'Account', action: 'Blocked purchase', label: selectedPlan });

                alert(
                    "Unfortunately, due to high levels of recent chargebacks & fraud, subscriptions for new accounts "+
                    "will temporarily require manual validation & processing before setup.\n\n" +
                    "Please email purchase@httptoolkit.tech to begin this process."
                );

                return;
            }

            // Otherwise, it's checkout time, and the rest is in the hands of Paddle
            yield this.purchasePlan(this.user.email!, selectedPlan);
        } catch (error: any) {
            reportError(error);
            alert(`${
                error.message || error.code || 'Error'
            }\n\nPlease check your email for details.\nIf you need help, get in touch at billing@httptoolkit.tech.`);
            this.modal = undefined;
        }
    }.bind(this));

    logIn = flow(function * (this: AccountStore) {
        let initialModal = this.modal;
        this.modal = 'login';

        trackEvent({ category: 'Account', action: 'Login' });
        const loggedIn: boolean = yield showLoginDialog();

        if (loggedIn) {
            trackEvent({ category: 'Account', action: 'Login success' });
            if (this.userHasSubscription) {
                trackEvent({ category: 'Account', action: 'Paid user login' });
                this.modal = undefined;

                if (this.isPastDueUser) this.goToSettings();
            } else {
                this.modal = initialModal;
            }
        } else {
            trackEvent({ category: 'Account', action: 'Login failed' });
            this.modal = undefined;
        }

        return loggedIn;
    }.bind(this));

    @action.bound
    logOut() {
        logOut();
    }

    private pickPlan = flow(function * (this: AccountStore) {
        this.modal = 'pick-a-plan';

        yield when(() => this.modal === undefined || !!this.selectedPlan);

        const selectedPlan = this.selectedPlan;
        this.selectedPlan = undefined;
        this.modal = undefined;

        if (selectedPlan) {
            trackEvent({ category: 'Account', action: 'Plan selected', label: selectedPlan });
        } else if (!this.isPaidUser) {
            // If you don't pick a plan via any route other than already having
            // bought them, then you're pretty clearly rejecting them.
            trackEvent({ category: 'Account', action: 'Plans rejected' });
        }

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
        openCheckout(email, planCode);
        this.modal = 'post-checkout';

        let focused = true;

        const setFocused = () => {
            focused = true;
            this.updateUser();
        };

        const setUnfocused = () => {
            focused = false;
        };

        window.addEventListener('focus', setFocused);
        window.addEventListener('blur', setUnfocused);

        // Keep checking the user's subscription data whilst they check out in their browser...
        yield this.updateUser();
        let ticksSinceCheck = 0;
        while (!this.isPaidUser && this.modal) {
            yield delay(500);
            ticksSinceCheck += 1;

            if (focused || ticksSinceCheck > 20) {
                // Every 10s while blurred or 500ms while focused, check the user data:
                ticksSinceCheck = 0;
                yield this.updateUser();
            }
        }

        if (this.isPaidUser && !focused) window.focus(); // Jump back to the front after checkout

        window.removeEventListener('focus', setFocused);
        window.removeEventListener('blur', setUnfocused);

        trackEvent({
            category: 'Account',
            action: this.isPaidUser ? 'Checkout complete' : 'Checkout cancelled',
            label: planCode
        });

        this.modal = undefined;
    });

    @action.bound
    cancelCheckout() {
        this.modal = this.selectedPlan = undefined;
    }

}