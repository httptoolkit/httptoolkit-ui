import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, autorun, computed, observe } from 'mobx';

import { Theme, ThemeName, Themes } from '../../styles';
import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';
import { unreachableCheck, UnreachableCheck } from '../../util/error';

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
export type ExpandableViewCardKey = typeof EXPANDABLE_VIEW_CARD_KEYS[number];

const isExpandableViewCard = (key: any): key is ExpandableViewCardKey =>
    EXPANDABLE_VIEW_CARD_KEYS.includes(key);

const SEND_CARD_KEYS = [
    'requestHeaders',
    'requestBody',
    'responseHeaders',
    'responseBody'
] as const;
type SendCardKey = typeof SEND_CARD_KEYS[number];

const isSendRequestCard = (key: SendCardKey): key is 'requestHeaders' | 'requestBody' =>
    key.startsWith('request');

const isSentResponseCard = (key: SendCardKey): key is 'responseHeaders' | 'responseBody' =>
    key.startsWith('response');

const SEND_REQUEST_CARD_KEYS = SEND_CARD_KEYS.filter(isSendRequestCard);
const SENT_RESPONSE_CARD_KEYS = SEND_CARD_KEYS.filter(isSentResponseCard);

const EXPANDABLE_SEND_REQUEST_CARD_KEYS = [
    'requestHeaders',
    'requestBody',
] as const;
type ExpandableSendRequestCardKey = typeof EXPANDABLE_SEND_REQUEST_CARD_KEYS[number];

const EXPANDABLE_SENT_RESPONSE_CARD_KEYS = [
    'responseHeaders',
    'responseBody'
] as const;
type ExpandableSentResponseCardKey = typeof EXPANDABLE_SENT_RESPONSE_CARD_KEYS[number];

type ExpandableSendCardKey = ExpandableSendRequestCardKey | ExpandableSentResponseCardKey;

const isExpandableSendCard = (key: any): key is ExpandableSendCardKey =>
    EXPANDABLE_SEND_REQUEST_CARD_KEYS.includes(key) ||
    EXPANDABLE_SENT_RESPONSE_CARD_KEYS.includes(key);

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
            if (!this.accountStore.isPaidUser) {
                this.setTheme('light');
            }
        });

        await hydrate({
            key: 'ui-store',
            store: this
        });

        const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)");
        this._setPrefersDarkTheme(darkThemeMq.matches);
        darkThemeMq.addEventListener('change', e => {
            this._setPrefersDarkTheme(e.matches);
        });

        console.log('UI store initialized');
    });

    @action.bound
    setTheme(themeNameOrObject: Theme | ThemeName | 'automatic') {
        if (typeof themeNameOrObject === 'string') {
            this._themeName = themeNameOrObject;
            this.customTheme = undefined;
        } else {
            this._themeName = 'custom';
            this.customTheme = themeNameOrObject;
        }
    }

    @persist @observable
    private _themeName: ThemeName | 'automatic' | 'custom' = 'light';

    get themeName() {
        return this._themeName;
    }

    /**
     * Stores if user prefers a dark color theme (for example when set in system settings).
     * Used if automatic theme is enabled.
     */
    @observable
    private _prefersDarkTheme: boolean = false;

    @action.bound
    private _setPrefersDarkTheme(value: boolean) {
        this._prefersDarkTheme = value;
    }

    @persist('object') @observable
    private customTheme: Theme | undefined = undefined;

    @computed
    get theme(): Theme {
        switch(this.themeName) {
            case 'automatic':
                return {...Themes[this._prefersDarkTheme ? 'dark' : 'light']}
            case 'custom':
                return this.customTheme!;
            default:
                return Themes[this.themeName];
        }
    }

    // Set briefly at the moment any card expansion is toggled, to trigger animation for the expansion as it's
    // applied, not always (to avoid animating expanded cards when they're rendered e.g. when selecting a request).
    @observable
    private animatedExpansionCard: string | undefined;

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
            ariaLabel: `${_.startCase(key)} section`,
            expanded: key === this.animatedExpansionCard
                ?  'starting' as const
                : key === this.expandedViewCard,
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

            // Briefly set animatedExpansionCard, to trigger animation for this expansion:
            this.animatedExpansionCard = key;
            requestAnimationFrame(action(() => {
                this.animatedExpansionCard = undefined;
            }));
        }
    }

    // Store the send details cards state here
    @observable
    private readonly sendCardStates = {
        'requestHeaders': { collapsed: false },
        'requestBody': { collapsed: false },
        'responseHeaders': { collapsed: false },
        'responseBody': { collapsed: false }
    };

    @observable
    expandedSendRequestCard: ExpandableSendRequestCardKey | undefined;

    @observable
    expandedSentResponseCard: ExpandableSentResponseCardKey | undefined;

    @computed
    get sendCardProps() {
        return _.mapValues(this.sendCardStates, (state, key) => {
            const expandedState = key === this.expandedSendRequestCard
                || key === this.expandedSentResponseCard;

            return {
                key,
                ariaLabel: `${_.startCase(key)} section`,
                expanded: expandedState,
                collapsed: state.collapsed && !expandedState,
                onCollapseToggled: this.toggleSendCardCollapsed.bind(this, key as SendCardKey),
                onExpandToggled: isExpandableSendCard(key)
                    ? this.toggleSendCardExpanded.bind(this, key)
                    : _.noop
            };
        });
    }

    @action
    toggleSendCardCollapsed(key: SendCardKey) {
        const cardState = this.sendCardStates[key];
        cardState.collapsed = !cardState.collapsed;

        const siblingCards: SendCardKey[] = isSendRequestCard(key)
            ? SEND_REQUEST_CARD_KEYS
            : SENT_RESPONSE_CARD_KEYS;

        // If you collapse all cards, pop open an alternative, just because it looks a bit weird
        // if you don't, and it makes it easier to quickly switch like an accordion in some cases.
        if (siblingCards.every((k) => this.sendCardStates[k].collapsed)) {
            const keyIndex = siblingCards.indexOf(key);
            const bestAlternativeCard = (keyIndex === siblingCards.length - 1)
                ? siblingCards[keyIndex - 1] // For last card, look back one
                : siblingCards[keyIndex + 1] // Otherwise, look at next card

            this.toggleSendCardCollapsed(bestAlternativeCard);
        }

        if (isSendRequestCard(key)) {
            this.expandedSendRequestCard = undefined;
        } else if (isSentResponseCard(key)) {
            this.expandedSentResponseCard = undefined;
        } else {
            throw new UnreachableCheck(key);
        }
    }

    @action
    private toggleSendCardExpanded(key: ExpandableSendCardKey) {
        const expandedCardField = isSendRequestCard(key)
                ? 'expandedSendRequestCard'
            : isSentResponseCard(key)
                ? 'expandedSentResponseCard'
            : unreachableCheck(key);

        if (this[expandedCardField] === key) {
            this[expandedCardField] = undefined;
        } else if (isExpandableSendCard(key)) {
            this.sendCardStates[key].collapsed = false;
            this[expandedCardField] = key as any; // We ensured key matches the field already above

            // We don't bother with animatedExpansionCard - not required for Send (we just
            // animate top-line margin, not expanded card padding)
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
            ariaLabel: `${_.startCase(key)} section`,
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

    handleContextMenuEvent<T>(
        event: React.MouseEvent,
        items: readonly ContextMenuItem<T>[],
        data: T
    ): void;
    handleContextMenuEvent(
        event: React.MouseEvent,
        items: readonly ContextMenuItem<void>[]
    ): void;
    @action.bound
    handleContextMenuEvent<T>(
        event: React.MouseEvent,
        items: readonly ContextMenuItem<T>[],
        data?: T
    ): void {
        if (!items.length) return;

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
                    selectedItem.callback(data!);
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
