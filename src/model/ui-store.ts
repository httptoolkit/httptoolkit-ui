
import * as _ from 'lodash';
import { configure, observable, action, autorun, computed, observe } from 'mobx';
import { persist, create } from 'mobx-persist';

import { Theme, lightTheme, ThemeName, Themes } from '../styles';
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
    }

    private loadSettings() {
        return create()('ui-store', this);
    }

    @action.bound
    setTheme(themeNameOrObject: Theme | ThemeName) {
        if (typeof themeNameOrObject === 'string') {
            this._themeName = themeNameOrObject;
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
    private customTheme: Theme = lightTheme;

    @computed
    get theme(): Theme {
        if (this.themeName === 'custom') {
            return this.customTheme;
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
}