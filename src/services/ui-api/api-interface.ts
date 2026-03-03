import { OperationRegistry } from './api-registry';
import { registerAllOperations } from './operations';

import { DesktopApi } from '../desktop-api';
import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';

export function initializeUiApi(stores: {
    accountStore: AccountStore;
    eventsStore: EventsStore;
}) {
    if (!DesktopApi.setApiOperations || !DesktopApi.onOperationRequest) {
        console.log("UI API not available");
        return;
    }

    const { accountStore, eventsStore } = stores;

    const registry = new OperationRegistry(
        () => accountStore.isPaidUser
    );

    registerAllOperations(
        registry,
        () => eventsStore.events
    );

    DesktopApi.setApiOperations(registry.getDefinitions());
    DesktopApi.onOperationRequest(async (operation, params) => {
        return await registry.execute(operation, params || {});
    });
}
