import { formatJson } from './json';

export interface EventStreamEvent {
    comments: string[];
    // Repeated fields take the last value, as in browsers
    fields: Map<string, string>;
    data: string | undefined;
}

export function parseEventStream(text: string): EventStreamEvent[] {
    const events: EventStreamEvent[] = [];

    let comments: string[] = [];
    let fields = new Map<string, string>();
    let dataLines: string[] = [];

    const dispatch = () => {
        if (comments.length || fields.size || dataLines.length) {
            events.push({
                comments,
                fields,
                data: dataLines.length ? dataLines.join('\n') : undefined
            });
        }

        comments = [];
        fields = new Map();
        dataLines = [];
    };

    const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);

    for (const line of lines) {
        if (line === '') {
            dispatch();
        } else if (line[0] === ':') {
            comments.push(stripLeadingSpace(line.slice(1)));
        } else {
            const colonIndex = line.indexOf(':');
            const name = colonIndex === -1 ? line : line.slice(0, colonIndex);
            const value = colonIndex === -1 ? '' : stripLeadingSpace(line.slice(colonIndex + 1));

            if (name === 'data') {
                dataLines.push(value);
            } else {
                fields.set(name, value);
            }
        }
    }

    // A truncated stream may end without a blank line - we show that final event anyway:
    dispatch();

    return events;
}

const stripLeadingSpace = (value: string) =>
    value[0] === ' ' ? value.slice(1) : value;

const isValidJson = (text: string) => {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
};

// Shows the event stream as a JSON array of events, with JSON data included as JSON
// (inserted verbatim, so large numbers etc are preserved) and anything else as strings.
export function formatEventStreamAsJson(text: string): string {
    const events = parseEventStream(text).map((event) => {
        const properties: string[] = [];

        if (event.comments.length) {
            properties.push(`"comment":${JSON.stringify(event.comments.join('\n'))}`);
        }

        for (const [name, value] of event.fields) {
            properties.push(`${JSON.stringify(name)}:${JSON.stringify(value)}`);
        }

        if (event.data !== undefined) {
            const data = isValidJson(event.data)
                ? event.data
                : JSON.stringify(event.data);
            properties.push(`"data":${data}`);
        }

        return `{${properties.join(',')}}`;
    });

    return formatJson(`[${events.join(',')}]`);
}
