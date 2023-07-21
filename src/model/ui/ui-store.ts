import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, autorun, computed, observe } from 'mobx';

import { Theme, ThemeName, Themes } from '../../styles';
import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';

import { AccountStore } from '../account/account-store';
import { emptyFilterSet, FilterSet } from '../filters/search-filters';
import { DesktopApi } from '../../services/desktop-api';
import {
    ContextMenuState,
    ContextMenuItem,
    ContextMenuOption,
    buildNativeContextMenuItems
} from './context-menu';

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

const EXPANDABLE_VIEW_CARD_KEYS = [
    'requestBody',
    'responseBody',
    'webSocketMessages'
] as const;
type ExpandableViewCardKey = typeof EXPANDABLE_VIEW_CARD_KEYS[number];

const isExpandableViewCard = (key: any): key is ExpandableViewCardKey =>
    EXPANDABLE_VIEW_CARD_KEYS.includes(key);

const SEND_CARD_KEYS = [
    'requestHeaders',
    'requestBody',
    'response',
    'responseBody'
] as const;
type SendCardKey = typeof SEND_CARD_KEYS[number];

const EXPANDABLE_SEND_CARD_KEYS = [
    'requestHeaders',
    'requestBody',
    'response',
    'responseBody'
] as const;
type ExpandableSendCardKey = typeof EXPANDABLE_SEND_CARD_KEYS[number];

const isExpandableSendCard = (key: any): key is ExpandableSendCardKey =>
EXPANDABLE_SEND_CARD_KEYS.includes(key);

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

    @observable
    expandCompleted = true; // Used to trigger animations during expand process

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
    expandedViewCard: ExpandableViewCardKey | undefined;

    @computed
    get viewCardProps() {
        return _.mapValues(this.viewCardStates, (state, key) => ({
            key,
            expanded: key === this.expandedViewCard,
            collapsed: state.collapsed && key !== this.expandedViewCard,
            onCollapseToggled: this.toggleViewCardCollapsed.bind(this, key as ViewCardKey),
            onExpandToggled: isExpandableViewCard(key)
                ? this.toggleViewCardExpanded.bind(this, key)
                : _.noop
        }));
    }

    @action
    toggleViewCardCollapsed(key: ViewCardKey) {
        const cardState = this.viewCardStates[key];
        cardState.collapsed = !cardState.collapsed;
        this.expandedViewCard = undefined;
    }

    @action
    private toggleViewCardExpanded(key: ExpandableViewCardKey) {
        if (this.expandedViewCard === key) {
            this.expandedViewCard = undefined;
        } else if (isExpandableViewCard(key)) {
            this.viewCardStates[key].collapsed = false;
            this.expandedViewCard = key;

            this.expandCompleted = false;
            requestAnimationFrame(action(() => {
                this.expandCompleted = true;
            }));
        }
    }

    // Store the send details cards state here
    @observable
    private readonly sendCardStates = {
        'requestHeaders': { collapsed: false },
        'requestBody': { collapsed: false },
        'response': { collapsed: false },
        'responseBody': { collapsed: false }
    };

    @observable
    expandedSendCard: ExpandableSendCardKey | undefined;

    @computed
    get sendCardProps() {
        return _.mapValues(this.sendCardStates, (state, key) => ({
            key,
            expanded: key === this.expandedSendCard,
            collapsed: state.collapsed && key !== this.expandedSendCard,
            onCollapseToggled: this.toggleSendCardCollapsed.bind(this, key as SendCardKey),
            onExpandToggled: isExpandableSendCard(key)
                ? this.toggleSendCardExpanded.bind(this, key)
                : _.noop
        }));
    }

    @action
    toggleSendCardCollapsed(key: SendCardKey) {
        const cardState = this.sendCardStates[key];
        cardState.collapsed = !cardState.collapsed;
        this.expandedSendCard = undefined;
    }

    @action
    private toggleSendCardExpanded(key: ExpandableSendCardKey) {
        if (this.expandedSendCard === key) {
            this.expandedSendCard = undefined;
        } else if (isExpandableSendCard(key)) {
            this.sendCardStates[key].collapsed = false;
            this.expandedSendCard = key;

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
        this.expandedViewCard = undefined;
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

    /**
     * This tracks the context menu state *only if it's not handled natively*. This state
     * is rendered by React as a fallback when DesktopApi.openContextMenu is not available.
     */
    @observable.ref // This shouldn't be mutated
    contextMenuState: ContextMenuState<any> | undefined;

    @action.bound
    handleContextMenuEvent<T>(
        event: React.MouseEvent,
        data: T,
        items: readonly ContextMenuItem<T>[]
    ) {
        event.preventDefault();

        if (DesktopApi.openContextMenu) {
            const position = { x: event.pageX, y: event.pageY };
            this.contextMenuState = undefined; // Should be set already, but let's be explicit

            DesktopApi.openContextMenu({
                position,
                items: buildNativeContextMenuItems(items)
            }).then((result) => {
                if (result) {
                    const selectedItem = _.get(items, result) as ContextMenuOption<T>;
                    selectedItem.callback(data);
                }
            }).catch((error) => {
                console.log(error);
                throw new Error('Error opening context menu');
            });
        } else {
            event.persist();
            this.contextMenuState = {
                data,
                event,
                items
            };
        }
    }

    @action.bound
    clearHtmlContextMenu() {
        this.contextMenuState = undefined;
    }

}
