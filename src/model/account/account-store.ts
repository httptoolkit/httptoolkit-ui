import * as _ from 'lodash';
import { observable, action, flow, computed, when, observe } from 'mobx';

import { logError, logErrorsAsUser } from '../../errors';
import { trackEvent } from '../../metrics';
import { delay } from '../../util/promise';
import { ObservablePromise, lazyObservablePromise, observablePromise } from '../../util/observable';

import {
    initializeAuthUi,
    loginEvents,
    showLoginDialog,
    logOut,

    User,
    getLatestUserData,
    getLastUserData,
    RefreshRejectedError,

    SKU,
    SubscriptionPlans,
    prepareCheckout,
    openNewCheckoutWindow,
    cancelSubscription,
    loadPlanPricesUntilSuccess
} from '@httptoolkit/accounts';

export class AccountStore {

    constructor(
        private goToSettings: () => void
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        // All async auth-related errors at any stage (bad tokens, invalid subscription data,
        // misc failures) will come through here, so we can log & debug later.
        loginEvents.on('app_error', logError);

        initializeAuthUi({
            // Proper indefinitely persistent session via refreshable token please
            refreshToken: true,

            // Don't persist logins for auto-login later. That makes sense for apps you log into
            // every day, but it's weird otherwise (e.g. after logout -> one-click login? Very odd).
            rememberLastLogin: false
        });

        this.subscriptionPlans = observablePromise(
            loadPlanPricesUntilSuccess()
        );

        // Update account data automatically on login, logout & every 10 mins
        loginEvents.on('authenticated', async (authResult) => {
            // If a user logs in after picking a plan, they're going to go to the
            // checkout imminently. The API has to query Paddle to build that checkout,
            // so we ping here early to kick that process off ASAP:
            const initialEmailResult = authResult?.idTokenPayload?.email;
            if (initialEmailResult && this.selectedPlan) {
                prepareCheckout(initialEmailResult, this.selectedPlan, 'app');
            }

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

        this.updateUser();
        setInterval(this.updateUser, 1000 * 60 * 10);
        loginEvents.on('logout', this.updateUser);

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
        });

        console.log('Account store initialized');
    });

    @observable
    private user: User = getLastUserData();

    @observable
    accountDataLastUpdated = 0;

    // Set when we know a checkout/cancel is processing elsewhere:
    @observable
    isAccountUpdateInProcess = false;

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
        logErrorsAsUser(this.user.email);

        if (this.user.banned) {
            alert('Your account has been blocked for abuse. Please contact help@httptoolkit.com.');
            window.close();
        }
    }.bind(this));

    subscriptionPlans!: ObservablePromise<SubscriptionPlans>;

    @observable
    modal: 'login' | 'pick-a-plan' | 'post-checkout' | undefined;

    @observable
    private selectedPlan: SKU | undefined;

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
        // Can't afford it? Get in touch: tim@httptoolkit.com.
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
            trackEvent({ category: 'Account', action: 'Get Pro', value: source });

            const selectedPlan: SKU | undefined = yield this.pickPlan();
            if (!selectedPlan) return;

            if (!this.isLoggedIn) yield this.logIn();

            // If we cancelled login, or we've already got a plan, we're done.
            if (!this.isLoggedIn || this.userHasSubscription) {
                if (this.isPastDueUser) this.goToSettings();
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
        this.selectedPlan = undefined;
        this.modal = 'pick-a-plan';

        yield when(() => this.modal === undefined || !!this.selectedPlan);

        this.modal = undefined;

        if (this.selectedPlan) {
            trackEvent({ category: 'Account', action: 'Plan selected', value: this.selectedPlan });
        } else if (!this.isPaidUser) {
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
        yield this.waitForUserUpdate(() => this.isPaidUser || !this.modal);
        this.isAccountUpdateInProcess = false;
        this.modal = undefined;

        trackEvent({
            category: 'Account',
            action: this.isPaidUser ? 'Checkout complete' : 'Checkout cancelled',
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