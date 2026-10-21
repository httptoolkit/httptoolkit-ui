import * as _ from 'lodash';

import { Operation, OperationResult } from '../api-types';
import { OperationRegistry } from '../api-registry';
import { serializeExchangeSummary, serializeExchangeOutline, serializeBody } from '../serialize';
import { HttpExchange, CollectedEvent } from '../../../types';
import { matchFilters } from '../../../model/filters/filter-matching';
import { Filter, SelectableSearchFilterClasses } from '../../../model/filters/search-filters';
import { EventsStore } from '../../../model/events/events-store';

// Free-tier body exports are capped to support exploration but not
// arbitrary export (paid feature).
const FREE_TIER_MAX_BODY_CHARS = 100_000;

export function registerEventOperations(
    registry: OperationRegistry,
    eventsStore: EventsStore,
    getEvents: () => ReadonlyArray<CollectedEvent>,
    isPaidUser: () => boolean
): void {
    registry.register(eventsListOperation(getEvents));
    registry.register(eventsGetOutlineOperation(getEvents));
    registry.register(eventsGetRequestBodyOperation(getEvents, isPaidUser));
    registry.register(eventsGetResponseBodyOperation(getEvents, isPaidUser));
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

// Unlike the UI, unparseable text is rejected rather than used for free-text matching,
// since agents generally intend structured filters & should see when they're invalid.
function parseFilters(filterString: string): Filter[] | OperationResult {
    const [stringFilter, ...filters] = matchFilters(SelectableSearchFilterClasses, filterString);

    if (stringFilter.filter !== '') {
        return {
            success: false,
            error: {
                code: 'INVALID_PARAMS',
                message: `Could not parse filter at '${stringFilter.filter}'. ` +
                    'Only structured filters are supported - use contains(text) to search for text.'
            }
        };
    }

    return filters;
}

async function waitForDecodedBodies(exchange: HttpExchange): Promise<void> {
    const bodies = [
        exchange.request.body,
        ...(exchange.isSuccessfulExchange() ? [exchange.response.body] : [])
    ];

    await Promise.all(bodies
        // Streaming bodies only decode once complete, so we match those as-is
        .filter(body => body.isComplete())
        // Failures are matched as empty bodies, so must never block other results
        .map(body => body.waitForDecoding().catch(() => {}))
    );
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
            tiers: ['free', 'pro'],
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        description:
                            'Filter expression. Space-separated filters are ANDed together. ' +
                            'Free text is not supported - use contains(text) to search for text.\n' +
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
                const filters = parseFilters(filterString);
                if (!Array.isArray(filters)) return filters;

                // Apply the cheap filters first, so we only decode bodies where necessary
                const [bodyFilters, otherFilters] = _.partition(filters, f => f.requiresDecodedBodies);

                events = events.filter(event =>
                    otherFilters.every(f => f.matches(event))
                );

                if (bodyFilters.length) {
                    await Promise.all(events.map(waitForDecodedBodies));
                    events = events.filter(event =>
                        bodyFilters.every(f => f.matches(event))
                    );
                }
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
            tiers: ['free', 'pro'],
            sessionLimit: 500,
            freeTierNote: 'This operation is limited to 500 calls per session for free users, so ' +
                'ensure only the necessary events are queried. Upgrade to Pro (account.upgrade) ' +
                'for unlimited access to all features.',
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

function effectiveMaxLength(requested: number | undefined, isPaid: boolean): number | undefined {
    if (isPaid) return requested;
    if (requested === undefined) return FREE_TIER_MAX_BODY_CHARS;
    return Math.min(requested, FREE_TIER_MAX_BODY_CHARS);
}

function eventsGetRequestBodyOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>,
    isPaidUser: () => boolean
): Operation {
    return {
        definition: {
            name: 'events.get-request-body',
            description: 'Get the request body of a captured HTTP exchange. ' +
                'Use offset and maxLength to retrieve specific ranges of large bodies.',
            category: 'events',
            tiers: ['free', 'pro'],
            sessionLimit: 100,
            freeTierNote: `Response bodies are capped at ${FREE_TIER_MAX_BODY_CHARS} ` +
                'characters per call. Page through larger bodies with offset, or upgrade ' +
                'to Pro (account.upgrade) for full bodies.',
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
                maxLength: effectiveMaxLength(params.maxLength as number | undefined, isPaidUser())
            });
            return { success: true, data: body };
        }
    };
}

function eventsGetResponseBodyOperation(
    getEvents: () => ReadonlyArray<CollectedEvent>,
    isPaidUser: () => boolean
): Operation {
    return {
        definition: {
            name: 'events.get-response-body',
            description: 'Get the response body of a captured HTTP exchange. ' +
                'Use offset and maxLength to retrieve specific ranges of large bodies.',
            category: 'events',
            tiers: ['free', 'pro'],
            sessionLimit: 100,
            freeTierNote: `Response bodies are capped at ${FREE_TIER_MAX_BODY_CHARS} ` +
                'characters per call. Page through larger bodies with offset, or upgrade ' +
                'to Pro (account.upgrade) for full bodies.',
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
                maxLength: effectiveMaxLength(params.maxLength as number | undefined, isPaidUser())
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
            tiers: ['free', 'pro'],
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
