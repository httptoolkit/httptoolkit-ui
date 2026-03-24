import { OperationRegistry } from './api-registry';
import { registerAllOperations } from './operations';
import { startServerOperationBridge } from './server-operation-bridge';

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
    const { accountStore, eventsStore, proxyStore, interceptorStore } = stores;

    const registry = new OperationRegistry(
        () => accountStore.user.isPaidUser()
    );

    registerAllOperations(
        registry,
        { eventsStore, proxyStore, interceptorStore },
        () => eventsStore.events
    );

    // Connect to the server's WebSocket bridge (for MCP and external tool access).
    const authToken = new URLSearchParams(window.location.search).get('authToken') ?? undefined;
    startServerOperationBridge(registry, authToken);
}
