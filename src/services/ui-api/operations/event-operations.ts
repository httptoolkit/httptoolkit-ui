import { Operation } from '../api-types';
import { OperationRegistry } from '../api-registry';
import { serializeExchangeSummary, serializeExchangeOutline, serializeBody } from '../serialize';
import { HttpExchange, CollectedEvent } from '../../../types';
import { matchFilters } from '../../../model/filters/filter-matching';
import { SelectableSearchFilterClasses } from '../../../model/filters/search-filters';
import { EventsStore } from '../../../model/events/events-store';

export function registerEventOperations(
    registry: OperationRegistry,
    eventsStore: EventsStore,
    getEvents: () => ReadonlyArray<CollectedEvent>
): void {
    registry.register(eventsListOperation(getEvents));
    registry.register(eventsGetOutlineOperation(getEvents));
    registry.register(eventsGetRequestBodyOperation(getEvents));
    registry.register(eventsGetResponseBodyOperation(getEvents));
    registry.register(eventsClearOperation(eventsStore));
}

function findHttpExchange(
    getEvents: () => ReadonlyArray<CollectedEvent>,
    id: string
): { exchange: HttpExchange } | { error: { code: string; message: string } } {
    if (!id) {
        return { error: { code: 'INVALID_PARAMS', message: 'Missing required parameter: id' } };
    }

    const event = getEvents().find(e => e.id === id);
    if (!event) {
        return { error: { code: 'NOT_FOUND', message: `No event found with ID: ${id}` } };
    }

    if (!event.isHttp()) {
        return { error: { code: 'NOT_SUPPORTED', message: `Event ${id} is not an HTTP exchange` } };
    }

    return { exchange: event };
}

function eventsListOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>
): Operation {
    return {
        definition: {
            name: 'events.list',
            description: 'List captured HTTP exchanges with optional filtering and pagination. ' +
                'Uses the same filter syntax as the UI search bar. ' +
                'See https://httptoolkit.com/docs/reference/view-page/#filtering-intercepted-traffic for full docs.',
            category: 'events',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        description:
                            'Filter expression. Space-separated filters are ANDed together. ' +
                            'Operators: = != ^= $= *= > >= < <=\n' +
                            '\n' +
                            'Common filters (subset - see https://httptoolkit.com/docs/reference/view-page/#filtering-intercepted-traffic for all options):\n' +
                            '- method (method=GET)\n' +
                            '- hostname (hostname=example.com, hostname$=.google.com)\n' +
                            '- path (path^=/api)\n' +
                            '- status (status=200, status>=400)\n' +
                            '- header[name] (header[Authorization]^=Bearer)\n' +
                            '- body (body*=error)\n' +
                            '- bodySize (bodySize>=1000)\n' +
                            '- completed, pending, aborted, errored\n' +
                            '- contains(x) - search method, URL, headers & body at once\n' +
                            '- not(filter) and or(a, b) for logical composition\n' +
                            '\n' +
                            'Examples:\n' +
                            '- "status!=404 method=POST" - non-404 POST requests\n' +
                            '- "hostname*=api contains(password)" - requests to API hosts containing "password" anywhere\n' +
                            '- "not(path$=.css) bodySize>=10000" - large responses excluding CSS files'
                    },
                    offset: {
                        type: 'number',
                        description: 'Number of events to skip (default 0)'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of events to return (default 20)'
                    }
                }
            },
            outputSchema: {
                type: 'object',
                properties: {
                    total: { type: 'number', description: 'Total matching events (before pagination)' },
                    events: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                type: { type: 'string' },
                                method: { type: 'string' },
                                url: { type: 'string' },
                                status: {},
                                source: { type: 'string' },
                                timestamp: { type: 'number' }
                            }
                        }
                    }
                }
            }
        },
        handler: async (params) => {
            const filterString = params.filter as string | undefined;
            const offset = (params.offset as number) || 0;
            const limit = (params.limit as number) || 20;

            let events = getEvents().filter(e => e.isHttp());

            if (filterString) {
                const filters = matchFilters(SelectableSearchFilterClasses, filterString);
                events = events.filter(event =>
                    filters.every(f => f.matches(event))
                );
            }

            const total = events.length;
            const paged = events.slice(offset, offset + limit);

            return {
                success: true,
                data: {
                    total,
                    events: paged.map(serializeExchangeSummary)
                }
            };
        }
    };
}

const bodyInputProperties = {
    id: {
        type: 'string' as const,
        description: 'The event ID'
    },
    offset: {
        type: 'number' as const,
        description: 'Character offset to start from (default 0)'
    },
    maxLength: {
        type: 'number' as const,
        description: 'Maximum characters to return. Omit for full body.'
    }
};

const bodyOutputSchema = {
    type: 'object' as const,
    properties: {
        body: { type: 'string' as const, description: 'Body content (text)' },
        totalSize: { type: 'number' as const, description: 'Total body size in characters' },
        isTruncated: { type: 'boolean' as const, description: 'Whether the body was truncated by maxLength' }
    }
};

function eventsGetOutlineOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>
): Operation {
    return {
        definition: {
            name: 'events.get-outline',
            description: 'Get the outline of a captured HTTP exchange: request and response ' +
                'headers, status, timing, and body sizes, but not the body content itself. ' +
                'Use events.get-request-body or events.get-response-body to retrieve bodies.',
            category: 'events',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The event ID to retrieve'
                    }
                },
                required: ['id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    method: { type: 'string' },
                    url: { type: 'string' },
                    httpVersion: { type: 'string' },
                    status: {},
                    source: { type: 'string' },
                    timestamp: { type: 'number' },
                    tags: { type: 'array', items: { type: 'string' } },
                    timing: { type: 'object' },
                    request: {
                        type: 'object',
                        properties: {
                            method: { type: 'string' },
                            url: { type: 'string' },
                            httpVersion: { type: 'string' },
                            headers: { type: 'object' },
                            bodySize: { type: 'number' }
                        }
                    },
                    response: {}
                }
            }
        },
        handler: async (params) => {
            const lookup = findHttpExchange(getEvents, params.id as string);
            if ('error' in lookup) return { success: false, error: lookup.error };

            return { success: true, data: serializeExchangeOutline(lookup.exchange) };
        }
    };
}

function eventsGetRequestBodyOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>
): Operation {
    return {
        definition: {
            name: 'events.get-request-body',
            description: 'Get the request body of a captured HTTP exchange. ' +
                'Use offset and maxLength to retrieve specific ranges of large bodies.',
            category: 'events',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: bodyInputProperties,
                required: ['id']
            },
            outputSchema: bodyOutputSchema
        },
        handler: async (params) => {
            const lookup = findHttpExchange(getEvents, params.id as string);
            if ('error' in lookup) return { success: false, error: lookup.error };

            const body = await serializeBody(lookup.exchange, 'request', {
                offset: params.offset as number | undefined,
                maxLength: params.maxLength as number | undefined
            });
            return { success: true, data: body };
        }
    };
}

function eventsGetResponseBodyOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>
): Operation {
    return {
        definition: {
            name: 'events.get-response-body',
            description: 'Get the response body of a captured HTTP exchange. ' +
                'Use offset and maxLength to retrieve specific ranges of large bodies.',
            category: 'events',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: bodyInputProperties,
                required: ['id']
            },
            outputSchema: bodyOutputSchema
        },
        handler: async (params) => {
            const lookup = findHttpExchange(getEvents, params.id as string);
            if ('error' in lookup) return { success: false, error: lookup.error };

            const body = await serializeBody(lookup.exchange, 'response', {
                offset: params.offset as number | undefined,
                maxLength: params.maxLength as number | undefined
            });
            return { success: true, data: body };
        }
    };
}

function eventsClearOperation(eventsStore: EventsStore): Operation {
    return {
        definition: {
            name: 'events.clear',
            description: 'Clear all captured events. By default, pinned events are preserved.',
            category: 'events',
            annotations: { readOnlyHint: false, destructiveHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    clearPinned: {
                        type: 'boolean',
                        description: 'Whether to also clear pinned events (default false)'
                    }
                }
            },
            outputSchema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' }
                }
            }
        },
        handler: async (params) => {
            const clearPinned = (params.clearPinned as boolean) || false;
            eventsStore.clearInterceptedData(clearPinned);
            return { success: true, data: {} };
        }
    };
}
