import { Operation } from '../api-types';
import { AccountStore } from '../../../model/account/account-store';

export function registerAccountOperations(
    registry: { register(op: Operation): void },
    accountStore: AccountStore
): void {
    registry.register(accountUpgradeOperation(accountStore));
}

function accountUpgradeOperation(accountStore: AccountStore): Operation {
    return {
        definition: {
            name: 'account.upgrade',
            description: 'Start the upgrade process to HTTP Toolkit Pro. ' +
                'Opens the subscription signup flow in the HTTP Toolkit desktop app. ' +
                'Pro unlocks advanced remote control & MCP features including unlimited data ' +
                'access, interceptor activation, CLI control, and all future operations, in ' +
                'addition to all core UI features like advanced debugging, import/export, ' +
                'automated rewriting rules, persistent sessions, and advanced configuration. ' +
                'Starting this flow doesn\'t commit you to purchasing - the initial step just ' +
                'lists the plans and features available so you can make a decision.',
            category: 'account',
            tiers: ['free'],
            annotations: { readOnlyHint: false },
            inputSchema: {
                type: 'object',
                properties: {}
            },
            outputSchema: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                }
            }
        },
        handler: async () => {
            accountStore.getPro('mcp');
            return {
                success: true,
                data: {
                    message: 'The upgrade flow has been started in the HTTP Toolkit desktop app. ' +
                        'Please complete the checkout process there.'
                }
            };
        }
    };
}
