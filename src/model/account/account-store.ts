import * as _ from 'lodash';
import { observable, action, flow, computed, when, observe } from 'mobx';

import { logError, logErrorsAsUser } from '../../errors';
import { trackEvent } from '../../metrics';
import { delay } from '../../util/promise';
import { ObservablePromise, lazyObservablePromise, observablePromise } from '../../util/observable';

import {
    User,
    getLatestUserData,
    getLastUserData,
    logOut,

    SKU,
    SubscriptionPlans,
    prepareCheckout,
    openNewCheckoutWindow,
    cancelSubscription,
    loadPlanPricesUntilSuccess
} from '@httptoolkit/accounts';

// ------------------------------------------------------------------
// You could override settings in here to become a paid user for free.
// I'd rather you didn't! HTTP Toolkit takes time & love to build,
// and I can't do that if it doesn't pay my bills :-)
//
// Fund open source - if you want Pro, help pay for its development.
// Can't afford it? Get in touch: tim@httptoolkit.com.
// ------------------------------------------------------------------
export class AccountStore {

    constructor(
        private goToSettings: () => void
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        this.subscriptionPlans = observablePromise(
            loadPlanPricesUntilSuccess()
        );

        // Update account data automatically initially & every 10 mins
        this.updateUser();
        setInterval(this.updateUser, 1000 * 60 * 10);

        // Whenever account data updates, check if we're a non-user team admin, and notify (and
        // logout) if so. This isn't a security measure (admin's dont get access anyway) it's just
        // a UX question, as it can be confusing for admins otherwise when logging in doesn't work.
        observe(this, 'accountDataLastUpdated', () => {
            if (
                !this.user.subscription &&
                this.user.teamSubscription
            ) {
                alert(
                    "You are the administrator of an HTTP Toolkit team, but you aren't listed " +
                    "as an active member, so you don't have access to HTTP Toolkit's " +
                    "paid features yourself." +
                    "\n\n" +
                    "To manage your team, please visit accounts.httptoolkit.tech."
                );

                window.open(
                    "https://accounts.httptoolkit.tech",
                    "_blank",
                    "noreferrer noopener"
                );

                this.logOut();
            }

            if (this.userEmail === 'hi@httptoolkit.com') {
                if (localStorage.getItem('patched') !== 'true') {
                    localStorage.setItem('patched', 'true');
                    // Track once for our metrics, and to log the IP & user id:
                    trackEvent({ category: 'Account', action: 'Patch detected' });
                }
            }
        });

        console.log('Account store initialized');
    });

    @observable
    user: User = getLastUserData();

    @observable
    accountDataLastUpdated = 0;

    // Set when we know a checkout/cancel is processing elsewhere:
    @observable
    isAccountUpdateInProcess = false;

    @computed get userEmail() {
        return this.user.email;
    }

    @computed get userSubscription() {
        return this.user.userHasSubscription()
            ? this.user.subscription
            : undefined;
    }

    // Expose the JWT directly, for delegating auth to remote services (e.g. HTK local server
    // for MCP, public endpoint cloud server).
    get userJwt(): string {
        if (this.isLoggedIn && this.accountDataLastUpdated !== Infinity) {
            // We read accountDataLastUpdated just to set up a subscription, so this will
            // re-calculate on each JWT update, since we can't observe localStorage directly.
            // It's never actually Infinity.

            const jwt = localStorage.getItem('last_jwt');
            if (!jwt) throw new Error("No JWT found for logged in user");
            return jwt;
        } else {
            throw new Error("Can't get JWT for logged out user");
        }
    }

    private updateUser = flow(function * (this: AccountStore) {
        this.user = yield getLatestUserData();
        this.accountDataLastUpdated = Date.now();

        // Include the user id in error reports whilst they're logged in.
        // Useful generally, but especially for checkout/subscription issues.
        logErrorsAsUser(this.user.userId);

        if (this.user.banned) {
            alert('Your account has been blocked for abuse. Please contact help@httptoolkit.com.');
            window.close();
        }
    }.bind(this));

    subscriptionPlans!: ObservablePromise<SubscriptionPlans>;

    @observable
    private selectedPlan: SKU | undefined;

    @computed get isLoggedIn() {
        return !!this.user.email;
    }

    @computed get featureFlags() {
        return _.clone(this.user.featureFlags);
    }

    @computed get mightBePaidUser() {
        // Like isPaidUser, but returns true for users who have subscription data
        // locally that's expired, until we successfully make a first check.
        return this.user.isPaidUser() ||
            (this.accountDataLastUpdated === 0 &&
            !!this.user.subscription?.status &&
            this.user.subscription?.status !== 'past_due');
    }

    @observable
    modal: 'login' | 'pick-a-plan' | 'post-checkout' | undefined;

    getPro = flow(function * (this: AccountStore, source: string) {
        try {
            trackEvent({ category: 'Account', action: 'Get Pro', value: source });

            const selectedPlan: SKU | undefined = yield this.pickPlan();
            if (!selectedPlan) return;

            if (!this.isLoggedIn) yield this.logIn();

            // If we cancelled login, or we've already got a plan, we're done.
            if (!this.isLoggedIn || this.user.userHasSubscription()) {
                if (this.user.isPastDueUser()) this.goToSettings();
                return;
            }

            // It's checkout time, and the rest is in the hands of Paddle/PayPro
            yield this.purchasePlan(this.user.email!, selectedPlan);
        } catch (error: any) {
            logError(error);
            alert(`${
                error.message || error.code || 'Error'
            }\n\nPlease check your email for details.\nIf you need help, get in touch at billing@httptoolkit.com.`);
            this.modal = undefined;
        } finally {
            this.selectedPlan = undefined;
        }
    }.bind(this));

    logIn = flow(function * (this: AccountStore) {
        let initialModal = this.modal;
        this.modal = 'login';
        trackEvent({ category: 'Account', action: 'Login' });

        yield when(() => this.modal !== 'login');

        if (this.isLoggedIn) {
            trackEvent({ category: 'Account', action: 'Login success' });
            if (this.user.userHasSubscription()) {
                trackEvent({ category: 'Account', action: 'Paid user login' });
                this.modal = undefined;

                if (this.user.isPastDueUser()) this.goToSettings();
            } else {
                this.modal = initialModal;
            }
        } else {
            trackEvent({ category: 'Account', action: 'Login failed' });
            this.modal = undefined;
        }

        return this.isLoggedIn;
    }.bind(this));

    @action.bound
    cancelLogin() {
        this.modal = undefined;
    }

    finalizeLogin = flow(function* (this: AccountStore, email: string) {
        if (this.selectedPlan) {
            // If the user logs in after selecting the plan, they're probably going to the checkout.
            // Start aggressively preloading that now.
            prepareCheckout(email, this.selectedPlan, 'app');
        }
        yield this.updateUser();
        this.modal = undefined;
    }).bind(this);

    @action.bound
    logOut() {
        logOut();
        this.updateUser();
    }

    private pickPlan = flow(function * (this: AccountStore) {
        this.selectedPlan = undefined;
        this.modal = 'pick-a-plan';

        yield when(() => this.modal === undefined || !!this.selectedPlan);

        this.modal = undefined;

        if (this.selectedPlan) {
            trackEvent({ category: 'Account', action: 'Plan selected', value: this.selectedPlan });
        } else if (!this.user.isPaidUser()) {
            // If you don't pick a plan via any route other than already having
            // bought them, then you're pretty clearly rejecting them.
            trackEvent({ category: 'Account', action: 'Plans rejected' });
        }

        return this.selectedPlan;
    });

    @action.bound
    setSelectedPlan(plan: SKU | undefined) {
        if (plan) {
            this.selectedPlan = plan;
        } else {
            this.selectedPlan = this.modal = undefined;
        }
    }

    private purchasePlan = flow(function * (this: AccountStore, email: string, sku: SKU) {
        openNewCheckoutWindow(email, sku, 'app');

        this.modal = 'post-checkout';
        this.isAccountUpdateInProcess = true;
        yield this.waitForUserUpdate(() => this.user.isPaidUser() || !this.modal);
        this.isAccountUpdateInProcess = false;
        this.modal = undefined;

        trackEvent({
            category: 'Account',
            action: this.user.isPaidUser() ? 'Checkout complete' : 'Checkout cancelled',
            value: sku
        });
    });

    private waitForUserUpdate = flow(function * (
        this: AccountStore,
        completedCheck: () => boolean
    ) {
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

        // Keep checking the user's subscription data at intervals, whilst other processes
        // (browser checkout, update from payment provider) complete elsewhere...
        yield this.updateUser();
        let ticksSinceCheck = 0;
        while (!completedCheck()) {
            yield delay(1000);
            ticksSinceCheck += 1;

            if (focused || ticksSinceCheck > 10) {
                // Every 10s while blurred or 500ms while focused, check the user data:
                ticksSinceCheck = 0;
                yield this.updateUser();
            }
        }

        if (completedCheck() && !focused) window.focus(); // Jump back to the front after update

        window.removeEventListener('focus', setFocused);
        window.removeEventListener('blur', setUnfocused);
    });

    @action.bound
    cancelCheckout() {
        this.modal = this.selectedPlan = undefined;
    }

    get canManageSubscription() {
        return !!this.userSubscription?.canManageSubscription;
    }

    cancelSubscription = flow(function * (this: AccountStore) {
        try {
            this.isAccountUpdateInProcess = true;
            yield cancelSubscription();
            yield this.waitForUserUpdate(() =>
                !this.user.subscription ||
                this.user.subscription.status === 'deleted'
            );
            console.log('Subscription cancellation confirmed');
        } catch (e: any) {
            console.log(e);
            logError(`Subscription cancellation failed: ${e.message || e}`);
            throw e;
        } finally {
            this.isAccountUpdateInProcess = false;
        }
    });

}