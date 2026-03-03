import { OperationRegistry } from '../api-registry';
import { registerEventOperations } from './event-operations';
import { CollectedEvent } from '../../../types';

export function registerAllOperations(
    registry: OperationRegistry,
    getEvents: () => ReadonlyArray<CollectedEvent>
): void {
    registerEventOperations(registry, getEvents);
}
