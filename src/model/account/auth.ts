import * as _ from 'lodash';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';

import * as jwt from 'jsonwebtoken';
import * as Auth0 from 'auth0-js';
import { Auth0LockPasswordless } from 'auth0-lock';

import { lightTheme } from '../../styles';
import { reportError } from '../../errors';

import { SubscriptionPlanCode, getSubscriptionPlanCode } from './subscriptions';

const AUTH0_CLIENT_ID = 'KAJyF1Pq9nfBrv5l3LHjT9CrSQIleujj';
const AUTH0_DOMAIN = 'login.httptoolkit.tech';

// We read data from auth0 (via a netlify function), which includes
// the users subscription data, signed into a JWT that we can
// validate using this public key.
const AUTH0_DATA_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA4Al86E7F9ydLeVbuzzuE
NtmqfAJowXETCuwuVmvQV4gctSJYdWWS7ceZO/sFL8cy19/xmL+CNeVFLg6K3ZUg
nQszMdCb8JEMuWyKjiHakRnncByqPSJ9+BMCZtxmOQZscCbskeSNnqfg+BfDzzew
0TPJRpbdU8IrM4OQ7Fzi5hq199CldonZpUEzRkkqG+OxwXAbqibKxowOBdIMStYN
bXExME6JckfOSzUQnp06pc0lTQs//8YqoOW8Xp+dEs8aIW43bfQ5NO47uF8v0JBA
2oWy4cOvZ30eji0Zu8p00jDjYr25pHrnAXV+tCGQZ6Eegzmsi7Tv21oqu8T7mSQe
EuOXlYR7vsi9e2YiFmK50TPFW/qQGnufMc/s5elJ2/zuQ0Gu8ZdYxeXWMgGoTcVR
2fEQylKXtQ9rCa3Sg3VNAjHZZYlAPi+QRBjh9BPeMxKXgTUh8krJ3X2QS7ztN/RB
zfuLc9Ygc8uo52ob8vhWHt4BpcvmaIjJSndkgw9tlOtnuo4EPZFD65k68hlCwjCW
7NwnSlenOqBWsu06xyLiedDelhzK/KuPhZC84c7aucZvbBClYbMRaP8fkjWo4hdb
ExOrH4DQKch8G3cNscSVSLkXsGALNMmt8mg1dVM8oJVSBxh3fDItv3Zdcb+2YTzJ
UwwAWeV8Hmzu22hbCLpIsj0CAwEAAQ==
-----END PUBLIC KEY-----
`;

const auth0Lock = new Auth0LockPasswordless(AUTH0_CLIENT_ID, AUTH0_DOMAIN, {
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
    // authorization_error - something (login or data loading) goes wrong.
    return new Promise<boolean>((resolve, reject) => {
        loginEvents.once('user_data_loaded', () => resolve(true));
        loginEvents.once('hide', () => resolve(false));

        loginEvents.once('unrecoverable_error', reject);
        loginEvents.once('authorization_error', reject);
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
} | null = JSON.parse(localStorage.getItem('tokens')!);
// ! above because actually parse(null) -> null, so it's ok


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

// Must be run _inside_ a tokenMutex
async function refreshToken() {
    if (!tokens) throw new Error("Can't refresh tokens if we're not logged in");

    return new Promise<string>((resolve, reject) => {
        auth0Client.oauthToken({
            refreshToken: tokens!.refreshToken,
            grantType: 'refresh_token'
        }, (error, result: { accessToken: string }) => {
            if (error) reject(error);
            else {
                tokens!.accessToken = result.accessToken;
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

interface AppData {
    email: string;
    subscription_id: number;
    subscription_plan_id: number;
    subscription_expiry: number;
}

export type User = {
    email?: string
    subscription?: {
        id: number;
        plan: SubscriptionPlanCode;
        expiry: Date;
    };
};

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
        return {};
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
    if (!userJwt) return {};

    const appData = <AppData> jwt.verify(userJwt, AUTH0_DATA_PUBLIC_KEY, {
        algorithms: ['RS256'],
        audience: 'https://httptoolkit.tech/app_data',
        issuer: 'https://httptoolkit.tech/'
    });

    const subscription = {
        id: appData.subscription_id,
        plan: getSubscriptionPlanCode(appData.subscription_plan_id)!,
        expiry: new Date(appData.subscription_expiry)
    };

    return {
        email: appData.email,
        subscription: _.every(subscription) ? subscription : undefined
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