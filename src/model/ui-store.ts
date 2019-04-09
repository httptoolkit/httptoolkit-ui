
import * as _ from 'lodash';
import { configure, observable, action, autorun, computed } from 'mobx';
import { persist, create } from 'mobx-persist';

import { Theme, lightTheme, ThemeName, Themes } from '../styles';

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

    loadSettings() {
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
}