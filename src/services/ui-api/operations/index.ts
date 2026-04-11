import { OperationRegistry } from '../api-registry';
import { registerEventOperations } from './event-operations';
import { registerProxyOperations } from './proxy-operations';
import { registerInterceptorOperations } from './interceptor-operations';
import { registerAccountOperations } from './account-operations';
import { CollectedEvent } from '../../../types';
import { EventsStore } from '../../../model/events/events-store';
import { ProxyStore } from '../../../model/proxy-store';
import { InterceptorStore } from '../../../model/interception/interceptor-store';
import { AccountStore } from '../../../model/account/account-store';

export function registerAllOperations(
    registry: OperationRegistry,
    stores: {
        eventsStore: EventsStore;
        proxyStore: ProxyStore;
        interceptorStore: InterceptorStore;
        accountStore: AccountStore;
    },
    getEvents: () => ReadonlyArray<CollectedEvent>
): void {
    registerEventOperations(registry, stores.eventsStore, getEvents);
    registerProxyOperations(registry, stores.proxyStore);
    registerInterceptorOperations(registry, stores.interceptorStore);
    registerAccountOperations(registry, stores.accountStore);
}
