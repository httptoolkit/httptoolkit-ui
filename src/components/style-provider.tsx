import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { ThemeProvider, StyleSheetManager } from '../styles';
import { WithInjected } from '../types';

import { UiStore } from '../model/ui/ui-store';

const StyleProvider = inject('uiStore')(observer((p: {
    uiStore: UiStore,
    children: JSX.Element
}) => {
    return <ThemeProvider theme={p.uiStore.theme}>
        <StyleSheetManager disableVendorPrefixes={true}>
            { p.children }
        </StyleSheetManager>
    </ThemeProvider>
}));

const InjectedStyleProvider = StyleProvider as unknown as WithInjected<
    typeof StyleProvider,
    'uiStore'
>;
export { InjectedStyleProvider as StyleProvider };