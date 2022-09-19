import * as _ from 'lodash';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';
import { TypedError } from 'typed-error';

import * as jwt from 'jsonwebtoken';
import * as Auth0 from 'auth0-js';
import { Auth0LockPasswordless } from '@httptoolkit/auth0-lock';
const auth0Dictionary = require('@httptoolkit/auth0-lock/lib/i18n/en').default;
import * as dedent from 'dedent';

import { lightTheme } from '../../styles';
import { reportError } from '../../errors';

import { SubscriptionPlanCode, getSubscriptionPlanCode } from './subscriptions';
import { attempt } from '../../util/promise';

const AUTH0_CLIENT_ID = 'KAJyF1Pq9nfBrv5l3LHjT9CrSQIleujj';
const AUTH0_DOMAIN = 'login.httptoolkit.tech';

// We read data from auth0 (via a netlify function), which includes
// the users subscription data, signed into a JWT that we can
// validate using this public key.
const AUTH0_DATA_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzRLZvRoiWBQS8Fdqqh/h
xVDI+ogFZ2LdIiMOQmkq2coYNvBXGX016Uw9KNlweUlCXUaQZkDuQBmwxcs80PEn
IliLvJnOcIA9bAJFEF36uIwSI/ZRj0faExanLO78cdIx+B+p69kFGlohQGzJmS1S
v/IYYu032hO+F5ypR+AoXn6qtGGLVN0zAvsvLEF3urY5jHiVbgk2FWD3FWMU3oBF
jEEjeSlAFnwJZgeEMFeYni7W/rQ8seU8y3YMIg2UyHpeVNnuWbJFFwGq8Aumg4SC
mCVpul3MYubdv034/ipGZSKJTwgubiHocrSBdeImNe3xdxOw/Mo04r0kcZBg2l/b
7QIDAQAB
-----END PUBLIC KEY-----
`;

export class RefreshRejectedError extends TypedError {
    constructor(response: { description: string }) {
        super(`Token refresh failed with: ${response.description}`);
    }
}

const auth0Lock = new Auth0LockPasswordless(AUTH0_CLIENT_ID, AUTH0_DOMAIN, {
    configurationBaseUrl: 'https://cdn.eu.auth0.com',

    // Passwordless - email a code, confirm the code
    allowedConnections: ['email'],
    passwordlessMethod: 'code',

    auth: {
        // Entirely within the app please
        redirect: false,

        // Not used for redirects, but checked against auth0 config. Defaults to current URL, but
        // unfortunately that is a very large space, and each valid URL needs preconfiguring.
        redirectUrl: window.location.origin + '/',
        // Required for passwordless (not needed by default, but gets reset when we use redirectUrl)
        responseType: 'token',

        // Include offline, so we get a refresh token
        params: { scope: 'openid email offline_access app_metadata' },
    },

    // Don't persist logins for easy auto-login later. This makes sense for apps you log into
    // every day, but it's weird otherwise (e.g. after logout -> one-click login? Very odd).
    rememberLastLogin: false,

    // UI config
    autofocus: true,
    allowAutocomplete: true,
    theme: {
        primaryColor: lightTheme.popColor,
        logo: 'https://httptoolkit.tech/icon-600.png'
    },
    languageDictionary: Object.assign(auth0Dictionary, {
        title: 'Log in / Sign up',
        signUpTerms: dedent`
            No spam, this will only be used as your account login. By signing up, you accept the ToS & privacy policy.
        `
    })
});

export const loginEvents = new EventEmitter();

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
    // authorization_error - something (login/data loading/token request) goes wrong.
    return new Promise<boolean>((resolve, reject) => {
        loginEvents.once('user_data_loaded', () => resolve(true));
        loginEvents.once('hide', () => resolve(false));

        loginEvents.once('unrecoverable_error', reject);
        loginEvents.on('authorization_error', (err) => {
            if (err.code === 'invalid_user_password') return; // Invalid login token, no worries
            else {
                console.log("Unexpected auth error", err);
                reject(err);
            }
        });
    });
};

export const logOut = () => {
    loginEvents.emit('logout');
};

const auth0Client = new Auth0.Authentication({
    clientID: AUTH0_CLIENT_ID, domain: AUTH0_DOMAIN
});

let tokens: {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiry: number; // time in ms
} | null;

attempt(
    // ! because actually parse(null) -> null, so it's ok
    () => JSON.parse(localStorage.getItem('tokens')!)
)
.then((t) => tokens = t)
.catch((e) => {
    console.log('Invalid token', localStorage.getItem('tokens'), e);
    reportError('Failed to parse tokens');
});

const tokenMutex = new Mutex();

function setTokens(newTokens: typeof tokens) {
    return tokenMutex.runExclusive(() => {
        tokens = newTokens;
        localStorage.setItem('tokens', JSON.stringify(newTokens));
    });
}

loginEvents.on('authenticated', ({ accessToken, refreshToken, expiresIn }) => {
    setTokens({
        refreshToken: refreshToken!,
        accessToken,
        accessTokenExpiry: Date.now() + (expiresIn * 1000)
    });
});

loginEvents.on('logout', () => setTokens(null));

// Must be run inside a tokenMutex
async function refreshToken() {
    if (!tokens) throw new Error("Can't refresh tokens if we're not logged in");

    return new Promise<string>((resolve, reject) => {
        auth0Client.oauthToken({
            refreshToken: tokens!.refreshToken,
            grantType: 'refresh_token'
        }, (error: any, result: { accessToken: string, expiresIn: number }) => {
            if (error) {
                if (
                    [500, 403].includes(error.statusCode) &&
                    error.description && (
                        error.description.includes('Grant not found') ||
                        error.description.includes('invalid refresh token')
                    )
                ) {
                    // Auth0 is explicitly rejecting our refresh token.
                    reject(new RefreshRejectedError(error));
                } else {
                    // Some other unknown error, might be transient/network issues
                    reject(error);
                }
            }
            else {
                tokens!.accessToken = result.accessToken;
                tokens!.accessTokenExpiry = Date.now() + (result.expiresIn * 1000);
                localStorage.setItem('tokens', JSON.stringify(tokens));
                resolve(result.accessToken);
            }
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

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'deleted';

type AppData = {
    email: string;
    subscription_status?: SubscriptionStatus;
    subscription_id?: number;
    subscription_plan_id?: number;
    subscription_expiry?: number;
    update_url?: string;
    cancel_url?: string;
    last_receipt_url?: string;
    feature_flags?: string[];
    banned?: boolean;
}

type SubscriptionData = {
    id: number;
    status: SubscriptionStatus;
    plan: SubscriptionPlanCode;
    expiry: Date;
    updateBillingDetailsUrl?: string;
    cancelSubscriptionUrl?: string;
    lastReceiptUrl?: string;
};

export type User = {
    email?: string;
    banned: boolean;
    subscription?: SubscriptionData;
    featureFlags: string[];
};

const anonUser = (): User => ({ featureFlags: [], banned: false });

/*
 * Synchronously gets the last received user data, _without_
 * refreshing it in any way. After 7 days without a refresh
 * though, the result will change when the JWT expires.
 */
export function getLastUserData(): User {
    try {
        return parseUserData(localStorage.getItem('last_jwt'));
    } catch (e) {
        console.warn("Couldn't parse saved user data", e);
        return anonUser();
    }
}

/*
 * Get the latest valid user data we can. If possible, it loads the
 * latest data from the server. If that fails to load, or if it loads
 * but fails to parse, we return the latest user data.
 *
 * If there are no tokens available, or the latest data is expired,
 * this returns an empty (logged out) user.
 */
export async function getLatestUserData(): Promise<User> {
    const lastUserData = getLastUserData();

    try {
        const userJwt = await requestUserData();
        const userData = parseUserData(userJwt);
        localStorage.setItem('last_jwt', userJwt);
        return userData;
    } catch (e) {
        reportError(e);
        loginEvents.emit('authorization_error', e);
        return lastUserData;
    }
}

function parseUserData(userJwt: string | null): User {
    if (!userJwt) return anonUser();

    const appData = <AppData>jwt.verify(userJwt, AUTH0_DATA_PUBLIC_KEY, {
        algorithms: ['RS256'],
        audience: 'https://httptoolkit.tech/app_data',
        issuer: 'https://httptoolkit.tech/'
    });

    const subscription = {
        id: appData.subscription_id,
        status: appData.subscription_status,
        plan: getSubscriptionPlanCode(appData.subscription_plan_id),
        expiry: appData.subscription_expiry ? new Date(appData.subscription_expiry) : undefined,
        updateBillingDetailsUrl: appData.update_url,
        cancelSubscriptionUrl: appData.cancel_url,
        lastReceiptUrl: appData.last_receipt_url
    };

    if (_.some(subscription) && !subscription.plan) {
        // No plan means no recognized plan, i.e. an unknown id. This should never happen,
        // but error reports suggest it's happened at least once.
        reportError('Invalid subscription data', appData);
    }

    const optionalFields = [
        'lastReceiptUrl',
        'updateBillingDetailsUrl',
        'cancelSubscriptionUrl'
    ];

    return {
        email: appData.email,
        // Use undefined rather than {} when there's any missing required sub fields
        subscription: _.every(_.omit(subscription, ...optionalFields))
            ? subscription as SubscriptionData
            : undefined,
        featureFlags: appData.feature_flags || [],
        banned: !!appData.banned
    };
}

async function requestUserData(): Promise<string> {
    const token = await getToken();
    if (!token) return '';

    const appDataResponse = await fetch('https://accounts.httptoolkit.tech/.netlify/functions/get-app-data', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return appDataResponse.text();
}