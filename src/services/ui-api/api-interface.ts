import { OperationRegistry } from './api-registry';
import { registerAllOperations } from './operations';

import { DesktopApi } from '../desktop-api';
import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';
import { ProxyStore } from '../../model/proxy-store';
import { InterceptorStore } from '../../model/interception/interceptor-store';

export function initializeUiApi(stores: {
    accountStore: AccountStore;
    eventsStore: EventsStore;
    proxyStore: ProxyStore;
    interceptorStore: InterceptorStore;
}) {
    if (!DesktopApi.setApiOperations || !DesktopApi.onOperationRequest) {
        console.log("UI API not available");
        return;
    }

    const { accountStore, eventsStore, proxyStore, interceptorStore } = stores;

    const registry = new OperationRegistry(
        () => accountStore.user.isPaidUser()
    );

    registerAllOperations(
        registry,
        { eventsStore, proxyStore, interceptorStore },
        () => eventsStore.events
    );

    DesktopApi.setApiOperations(registry.getDefinitions());
    DesktopApi.onOperationRequest(async (operation, params) => {
        return await registry.execute(operation, params || {});
    });
}
