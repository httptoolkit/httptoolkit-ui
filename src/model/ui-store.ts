
import * as _ from 'lodash';
import { configure, observable, action, autorun } from 'mobx';
import { persist, create } from 'mobx-persist';

import { Theme, lightTheme } from '../styles';

configure({ enforceActions: 'observed' });

export class UiStore {

    constructor() {
        autorun(() => {
            // Any time the theme changes, update the HTML background to match
            document.querySelector('html')!.style.backgroundColor = this.theme.containerBackground;
        });
    }

    loadSettings() {
        return create()('ui-store', this);
    }

    @action.bound
    setTheme(theme: Theme) {
        this.theme = theme;
    }

    @persist('object') @observable.ref theme: Theme = lightTheme;
}