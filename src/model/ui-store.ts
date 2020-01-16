
import * as _ from 'lodash';
import { configure, observable, action, autorun, computed, observe } from 'mobx';
import { persist, create } from 'mobx-persist';

import { Theme, ThemeName, Themes } from '../styles';
import { AccountStore } from './account/account-store';

configure({ enforceActions: 'observed' });

export class UiStore {

    constructor() {
        autorun(() => {
            // Any time the theme changes, update the HTML background to match
            document.querySelector('html')!.style.backgroundColor = this.theme.containerBackground;

            // Persist the background colour standalone, so we can easily access it
            // from the index.html loading script, whether it's custom or computed
            localStorage.setItem('theme-background-color', this.theme.containerBackground);
        });
    }

    initialize(accountStore: AccountStore) {
        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(accountStore, 'accountDataLastUpdated', () => {
            if (!accountStore.isPaidUser) this.setTheme('light');
        });

        this.loadSettings();

        console.log('UI store initialized');
    }

    private loadSettings() {
        return create()('ui-store', this);
    }

    @action.bound
    setTheme(themeNameOrObject: Theme | ThemeName) {
        if (typeof themeNameOrObject === 'string') {
            this._themeName = themeNameOrObject;
            this.customTheme = undefined;
        } else {
            this._themeName = 'custom';
            this.customTheme = themeNameOrObject;
        }
    }

    @persist @observable
    private _themeName: ThemeName | 'custom' = 'light';

    get themeName() {
        return this._themeName;
    }

    @persist('object') @observable
    private customTheme: Theme | undefined = undefined;

    @computed
    get theme(): Theme {
        if (this.themeName === 'custom') {
            return this.customTheme!;
        } else {
            return Themes[this.themeName];
        }
    }

    // Store the view exchange details cards state here, so that it persists
    // when moving away from the page or deselecting all exchanges.
    @observable
    readonly viewExchangeCardStates = {
        'request': { collapsed: false },
        'requestBody': { collapsed: false },
        'response': { collapsed: false },
        'responseBody': { collapsed: false },

        'performance': { collapsed: true },
        'export': { collapsed: true }
    };

    @action.bound
    rememberElectronPath(path: string) {
        if (!this.previousElectronAppPaths.includes(path)) {
            this.previousElectronAppPaths.unshift(path);
        }

        // Keep only the most recent 3 electron paths used
        this.previousElectronAppPaths = this.previousElectronAppPaths.slice(0, 3);
    }

    @action.bound
    forgetElectronPath(path: string) {
        this.previousElectronAppPaths = this.previousElectronAppPaths.filter(p => p != path);
    }

    @persist('list') @observable
    previousElectronAppPaths: string[] = [
    ];
}