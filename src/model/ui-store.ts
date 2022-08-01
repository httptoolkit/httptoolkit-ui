import * as _ from 'lodash';
import { observable, action, autorun, computed, observe } from 'mobx';

import { Theme, ThemeName, Themes } from '../styles';
import { lazyObservablePromise } from '../util/observable';
import { persist, hydrate } from '../util/mobx-persist/persist';
import { AccountStore } from './account/account-store';
import { emptyFilterSet, FilterSet } from './filters/search-filters';

const VIEW_CARD_KEYS = [
    'api',

    'request',
    'requestBody',
    'response',
    'responseBody',

    'webSocketMessages',
    'webSocketClose',

    'rtcConnection',
    'rtcSessionOffer',
    'rtcSessionAnswer',

    'performance',
    'export'
] as const;
type ViewCardKey = typeof VIEW_CARD_KEYS[number];

const EXPANDABLE_CARD_KEYS = [
    'requestBody',
    'responseBody',
    'webSocketMessages'
] as const;
type ExpandableCardKey = typeof EXPANDABLE_CARD_KEYS[number];

const isExpandableCard = (key: any): key is ExpandableCardKey =>
    EXPANDABLE_CARD_KEYS.includes(key);

const SETTINGS_CARD_KEYS =[
    'account',
    'proxy',
    'connection',
    'api',
    'themes'
] as const;
type SettingsCardKey = typeof SETTINGS_CARD_KEYS[number];

export class UiStore {

    constructor(
        private accountStore: AccountStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await this.accountStore.initialized;

        autorun(() => {
            // Any time the theme changes, update the HTML background to match
            document.querySelector('html')!.style.backgroundColor = this.theme.containerBackground;

            // Persist the background colour standalone, so we can easily access it
            // from the index.html loading script, whether it's custom or computed
            localStorage.setItem('theme-background-color', this.theme.containerBackground);
        });

        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(this.accountStore, 'accountDataLastUpdated', () => {
            if (!this.accountStore.isPaidUser) this.setTheme('light');
        });

        await hydrate({
            key: 'ui-store',
            store: this
        });

        console.log('UI store initialized');
    });

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

    // Store the view details cards state here, so that they persist
    // when moving away from the page or deselecting all traffic.
    @observable
    private readonly viewCardStates = {
        'api': { collapsed: true },

        'request': { collapsed: false },
        'requestBody': { collapsed: false },
        'response': { collapsed: false },
        'responseBody': { collapsed: false },

        'webSocketMessages': { collapsed: false },
        'webSocketClose': { collapsed: false },

        'rtcConnection': { collapsed: false },
        'rtcSessionOffer': { collapsed: false },
        'rtcSessionAnswer': { collapsed: false },

        'performance': { collapsed: true },
        'export': { collapsed: true }
    };

    @observable
    expandedCard: ExpandableCardKey | undefined;

    @observable
    expandCompleted = true; // Used to trigger animations during expand process

    @computed
    get viewCardProps() {
        return _.mapValues(this.viewCardStates, (state, key) => ({
            key,
            expanded: key === this.expandedCard,
            collapsed: state.collapsed && key !== this.expandedCard,
            onCollapseToggled: this.toggleViewCardCollapsed.bind(this, key as ViewCardKey),
            onExpandToggled: isExpandableCard(key)
                ? this.toggleViewCardExpanded.bind(this, key)
                : _.noop
        }));
    }

    @action
    toggleViewCardCollapsed(key: ViewCardKey) {
        const cardState = this.viewCardStates[key];
        cardState.collapsed = !cardState.collapsed;
        this.expandedCard = undefined;
    }

    @action
    private toggleViewCardExpanded(key: ExpandableCardKey) {
        if (this.expandedCard === key) {
            this.expandedCard = undefined;
        } else if (isExpandableCard(key)) {
            this.viewCardStates[key].collapsed = false;
            this.expandedCard = key;

            this.expandCompleted = false;
            requestAnimationFrame(action(() => {
                this.expandCompleted = true;
            }));
        }
    }

    @observable
    private settingsCardStates = {
        'account': { collapsed: false },
        'proxy': { collapsed: false },
        'connection': { collapsed: false },
        'api': { collapsed: false },
        'themes': { collapsed: false }
    };

    @computed
    get settingsCardProps() {
        return _.mapValues(this.settingsCardStates, (state, key) => ({
            key,
            collapsed: state.collapsed,
            onCollapseToggled: this.toggleSettingsCardCollapsed.bind(this, key as SettingsCardKey)
        }));
    }

    @action
    toggleSettingsCardCollapsed(key: SettingsCardKey) {
        const cardState = this.settingsCardStates[key];
        cardState.collapsed = !cardState.collapsed;
        this.expandedCard = undefined;
    }

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
    previousElectronAppPaths: string[] = [];

    @observable
    activeFilterSet: FilterSet = emptyFilterSet();

    @persist('object') @observable
    _customFilters: { [name: string]: string } = {};

    @computed
    get customFilters() {
        if (this.accountStore.isPaidUser) {
            return this._customFilters;
        } else {
            return {};
        }
    }

    @persist @observable
    preferredShell: string | undefined = 'Bash';

    @persist @observable
    exportSnippetFormat: string | undefined;

}