import * as _ from 'lodash';
import { observable, runInAction } from 'mobx';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';

import * as Auth0 from 'auth0-js';
import { Auth0LockPasswordless } from 'auth0-lock';

import { lightTheme } from '../styles';

const auth0ClientId = 'KAJyF1Pq9nfBrv5l3LHjT9CrSQIleujj';
const auth0Domain = 'login.httptoolkit.tech';
const paddleVendorId = 37222;

export interface SubscriptionPlan {
    id: number;
    prices?: {
        monthly: string;
        total: string;
    };
}

export const SubscriptionPlans: _.Dictionary<SubscriptionPlan> = {
    'pro-monthly': { id: 550380 },
    'pro-annual': { id: 550382 },
    'team-monthly': { id: 550789 },
    'team-annual': { id: 550788 },
};

export type SubscriptionPlanCode = keyof typeof SubscriptionPlans;

const auth0Lock = new Auth0LockPasswordless(auth0ClientId, auth0Domain, {
    configurationBaseUrl: 'https://cdn.eu.auth0.com',

    // Passwordless - email a code, confirm the code
    allowedConnections: ['email'],
    passwordlessMethod: 'code',

    auth: {
        // Entirely within the app please
        redirect: false,

        // Include offline, so we get a refresh token
        params: { scope: 'openid email offline_access app_metadata' },
    },

    // UI config
    autofocus: true,
    allowAutocomplete: true,
    theme: {
        primaryColor: lightTheme.popColor,
        logo: 'https://httptoolkit.tech/icon-600.png'
    },
    languageDictionary: {
        title: 'Log in / Sign up'
    }
});

const loginEvents = new EventEmitter();

// Forward auth0 events to the emitter
[
    'authenticated',
    'unrecoverable_error',
    'authorization_error',
    'hide'
].forEach((event) => auth0Lock.on(event, (data) => loginEvents.emit(event, data)));

loginEvents.on('user_data_loaded', () => auth0Lock.hide());

export const showLoginDialog = () => {
    auth0Lock.show();

    // Login is always followed by either:
    // hide - user cancels login
    // user_data_loaded - everything successful
    // authorization_error - something (login or data loading) goes wrong.
    return new Promise<boolean>((resolve, reject) => {
        loginEvents.once('user_data_loaded', () => resolve(true));
        loginEvents.once('hide', () => resolve(false));

        loginEvents.once('unrecoverable_error', reject);
        loginEvents.once('authorization_error', reject);
    });
};

export const logOut = () => {
    tokens = undefined;
    loginEvents.emit('logout');
};

const auth0Client = new Auth0.Authentication({
    clientID: auth0ClientId, domain: auth0Domain
});

let tokens: {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiry: number; // time in ms
} | undefined;
const tokenMutex = new Mutex();

loginEvents.on('authenticated', ({ accessToken, refreshToken, expiresIn }) => {
    tokenMutex.runExclusive(() => {
        tokens = {
            refreshToken: refreshToken!,
            accessToken,
            accessTokenExpiry: Date.now() + (expiresIn * 1000)
        };
    });
});

loginEvents.on('logout', () => {
    tokenMutex.runExclusive(() => {
        tokens = undefined;
    });
});

async function refreshToken() {
    if (!tokens) throw new Error("Can't refresh tokens if we're not logged in");

    return new Promise<string>((resolve, reject) => {
        auth0Client.oauthToken({
            refreshToken: tokens!.refreshToken,
            grantType: 'refresh_token'
        }, (error, result: { accessToken: string }) => {
            if (error) reject(error);
            else resolve(result.accessToken);
        })
    });
}

function getToken() {
    return tokenMutex.runExclusive<string | undefined>(() => {
        if (!tokens) return;

        const timeUntilExpiry = tokens.accessTokenExpiry.valueOf() - Date.now();

        // If the token is expired or close (10 mins), refresh it
        let refreshPromise = timeUntilExpiry < 1000 * 60 * 10 ?
            refreshToken() : null;

        if (timeUntilExpiry > 1000 * 5) {
            // If the token is good for now, use it, even if we've
            // also triggered a refresh in the background
            return tokens.accessToken;
        } else {
            // If the token isn't usable, wait for the refresh
            return refreshPromise!;
        }
    });
};

interface Auth0ProfileWithAppData extends Auth0.Auth0UserProfile {
    'https://httptoolkit.tech/app_metadata': {
        email: string;
        subscription_id: number;
        subscription_plan_id: number;
        subscription_expiry: number;
    };
}

async function requestUserData(): Promise<User | undefined> {
    const token = await getToken();
    if (!token) return;

    const profile = await new Promise<Auth0.Auth0UserProfile>((resolve, reject) => {
        auth0Lock.getUserInfo(token, (error, profile) => {
            if (error) {
                loginEvents.emit('authorization_error', error);
                reject(error);
            } else {
                resolve(profile);
            }
        });
    });

    const appData = (profile as Auth0ProfileWithAppData)['https://httptoolkit.tech/app_metadata'];

    return {
        email: profile.email,
        subscription: {
            id: appData.subscription_id,
            plan: _.findKey(SubscriptionPlans, { id: appData.subscription_plan_id }) as SubscriptionPlanCode,
            expiry: new Date(appData.subscription_expiry)
        }
    };
}

export interface User {
    email?: string;
    subscription?: {
        id: number;
        plan: SubscriptionPlanCode;
        expiry: Date;
    };
}

export const getUser = () => {
    let user = observable<User>({ });

    const updateUser = async () => {
        const latestUserData = await requestUserData();

        runInAction(() => {
            if (latestUserData) {
                Object.assign(user, latestUserData);
            } else {
                delete user.email;
                delete user.subscription;
            }
        });
    };

    // Update user data on a timer or log in
    loginEvents.on('authenticated', async () => {
        await updateUser();
        loginEvents.emit('user_data_loaded')
    });
    loginEvents.on('logout', updateUser);
    setInterval(updateUser, 1000 * 60 * 5);

    return user;
};

export const openCheckout = async (email: string, planCode: string): Promise<boolean> => {
    const paddle = await waitForPaddle;

    return new Promise<boolean>((resolve) => {
        paddle.Checkout.open({
            product: SubscriptionPlans[planCode].id,
            email: email,
            disableLogout: true,
            allowQuantity: false,
            successCallback: () => resolve(true),
            closeCallback: () => resolve(false)
        });
    });
}

const waitForPaddle = new Promise<PaddleStatic>((resolve) => {
    const checkForPaddle = () => {
        if (!!(window as any).Paddle) {
            Paddle.Setup({ vendor: paddleVendorId });
            resolve(Paddle);
        } else {
            setTimeout(checkForPaddle, 500);
        }
    };

    checkForPaddle();
});

async function getPlanPrices(planId: number) {
    const paddle = await waitForPaddle;
    return new Promise<Pricing>((resolve) => {
        paddle.Product.Prices(planId, 1, resolve);
    });
}

_.map(SubscriptionPlans, async (PlanDetails) => {
    const planPricing = await getPlanPrices(PlanDetails.id);

    const planPrice = planPricing.price.net.replace(/[\.\,]00/g, '');
    const monthlyPrice = planPricing.recurring.subscription.type === 'year' ?
        planPrice.replace(/[\d\.\,]+/g, (d) => _.round((parseFloat(d) / 12), 2).toString()) : planPrice;

    PlanDetails.prices = { total: planPrice, monthly: monthlyPrice };
});