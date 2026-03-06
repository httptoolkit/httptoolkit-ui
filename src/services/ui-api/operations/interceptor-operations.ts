import { Operation } from '../api-types';
import { InterceptorStore } from '../../../model/interception/interceptor-store';
import { Interceptor } from '../../../model/interception/interceptors';

function isNonInteractive(interceptor: Interceptor): boolean {
    return !interceptor.uiConfig && !interceptor.customActivation && !interceptor.clientOnly;
}

export function registerInterceptorOperations(
    registry: { register(op: Operation): void },
    interceptorStore: InterceptorStore
): void {
    registry.register(interceptorsListOperation(interceptorStore));
    registry.register(interceptorsActivateOperation(interceptorStore));
}

function serializeInterceptor(interceptor: Interceptor) {
    return {
        id: interceptor.id,
        name: interceptor.name,
        description: interceptor.description.join(' '),
        isActive: interceptor.isActive,
        isActivable: interceptor.isActivable,
        isSupported: interceptor.isSupported,
        inProgress: !!interceptor.inProgress
    };
}

function interceptorsListOperation(interceptorStore: InterceptorStore): Operation {
    return {
        definition: {
            name: 'interceptors.list',
            description: 'List available interceptors and their current status. ' +
                'Shows which interceptors are supported, activable, and currently active.',
            category: 'interceptors',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {}
            },
            outputSchema: {
                type: 'object',
                properties: {
                    interceptors: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                description: { type: 'string' },
                                isActive: { type: 'boolean' },
                                isActivable: { type: 'boolean' },
                                isSupported: { type: 'boolean' },
                                inProgress: { type: 'boolean' }
                            }
                        }
                    }
                }
            }
        },
        handler: async () => {
            const interceptors = Object.values(interceptorStore.interceptors)
                .filter((i): i is Interceptor => !!i)
                .map(serializeInterceptor);

            return {
                success: true,
                data: { interceptors }
            };
        }
    };
}

function interceptorsActivateOperation(interceptorStore: InterceptorStore): Operation {
    return {
        definition: {
            name: 'interceptors.activate',
            description: 'Activate a non-interactive interceptor. Only simple interceptors that ' +
                'require no UI interaction or confirmation are supported (e.g. fresh browser windows, ' +
                'fresh-terminal, system-proxy). Interactive interceptors like docker-attach, ' +
                'android-adb, electron etc. require the full UI.',
            category: 'interceptors',
            annotations: { readOnlyHint: false },
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The interceptor ID to activate (e.g. "fresh-chrome", "fresh-terminal", "system-proxy")'
                    }
                },
                required: ['id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' }
                }
            }
        },
        handler: async (params) => {
            const id = params.id as string;

            if (!id) {
                return {
                    success: false,
                    error: { code: 'INVALID_PARAMS', message: 'Missing required parameter: id' }
                };
            }

            const interceptor = interceptorStore.interceptors[id];
            if (!interceptor) {
                return {
                    success: false,
                    error: { code: 'NOT_FOUND', message: `Unknown interceptor: ${id}` }
                };
            }

            if (!isNonInteractive(interceptor)) {
                return {
                    success: false,
                    error: {
                        code: 'INTERACTIVE_REQUIRED',
                        message: `Interceptor '${id}' (${interceptor.name}) requires interactive setup ` +
                            `through the UI. Only non-interactive interceptors can be activated via this API.`
                    }
                };
            }

            if (!interceptor.isActivable) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_ACTIVABLE',
                        message: `Interceptor '${id}' (${interceptor.name}) is not currently activable. ` +
                            `It may not be installed or supported on this system.`
                    }
                };
            }

            try {
                await interceptorStore.activateInterceptor(
                    id,
                    interceptor.activationOptions
                );
                return { success: true, data: {} };
            } catch (e) {
                return {
                    success: false,
                    error: {
                        code: 'ACTIVATION_FAILED',
                        message: `Failed to activate interceptor '${id}': ${
                            e instanceof Error ? e.message : String(e)
                        }`
                    }
                };
            }
        }
    };
}
