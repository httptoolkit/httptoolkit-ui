import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { ThemeProvider } from '../styles';
import { WithInjected } from '../types';

import { UiStore } from '../model/ui-store';

const StorePoweredThemeProvider = inject('uiStore')(observer((p: {
    uiStore: UiStore,
    children: JSX.Element
}) => {
    return <ThemeProvider theme={p.uiStore.theme}>
        { p.children }
    </ThemeProvider>
}));

const InjectedStorePoweredThemeProvider = StorePoweredThemeProvider as unknown as WithInjected<
    typeof StorePoweredThemeProvider,
    'uiStore'
>;
export { InjectedStorePoweredThemeProvider as StorePoweredThemeProvider };