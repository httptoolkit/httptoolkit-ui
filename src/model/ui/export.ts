import * as _ from 'lodash';
import * as dedent from 'dedent';
import * as HTTPSnippet from "@httptoolkit/httpsnippet";

import { saveFile } from "../../util/ui";
import { isProbablyUtf8 } from "../../util/buffer";

import { HttpExchangeView, MessageBody, ViewableEvent } from "../../types";
import {
    generateHarRequest,
    generateHar,
    ExtendedHarRequest,
    HarGenerationOptions
} from '../http/har';
import { StreamMessage } from '../events/stream-message';
import { buildHtkRequest } from '../http/http-exchange';
import { RequestInput, buildSentExchangeRequest } from '../send/send-request-model';
import { simplifyHarRequestForSnippetExport } from './snippet-export-sanitization';
import { SnippetOption } from './snippet-formats';

const MB = 1_000_000;
// Larger HARs may cause compatibility problems elsewhere, so bulk exports drop large bodies:
const HAR_SIZE_WARNING_LIMIT = 300 * MB;
// Larger HARs risk not exporting at all, so must be split up or exported differently:
const HAR_SIZE_MAX_LIMIT = 450 * MB;

// Very rough estimates of the non-body overhead (headers, metadata, JSON structure) per item & message:
const ITEM_OVERHEAD_ESTIMATE = 2_000;
const MESSAGE_OVERHEAD_ESTIMATE = 100;

// Binary content (non-UTF-8 bodies & binary messages) is base64 encoded in HARs:
const getBase64Size = (byteLength: number) => Math.ceil(byteLength / 3) * 4;

export interface HarSizeEstimate<B = MessageBody> {
    totalSize: number;
    // HTTP bodies are the only content we can drop to reduce the size:
    httpBodies: Array<{ body: B, size: number }>;
}

export async function estimateHarSize(
    events: ReadonlyArray<ViewableEvent>
): Promise<HarSizeEstimate> {
    const bodies = _.flatMap(events, (event): MessageBody[] => event.isHttp()
        ? [
            event.request.body,
            ...(event.isSuccessfulExchange() ? [event.response.body] : [])
        ]
        : []
    );
    const httpBodies = await Promise.all(bodies.map(async (body) => {
        const decoded = await body.waitForDecoding();
        return {
            body,
            size: !decoded
                ? 0
            : isProbablyUtf8(decoded)
                ? decoded.byteLength
            : getBase64Size(decoded.byteLength)
        };
    }));

    // Connections export all their streams, so collect each stream only once:
    const streamMessages = new Set<ReadonlyArray<StreamMessage>>();
    events.forEach((event) => {
        if (event.isWebSocket()) streamMessages.add(event.messages);
        else if (event.isRawTunnel()) streamMessages.add(event.packets);
        else if (event.isRTCDataChannel()) streamMessages.add(event.messages);
        else if (event.isRTCConnection()) {
            event.streams.forEach((stream) => {
                if (stream.isRTCDataChannel()) streamMessages.add(stream.messages);
            });
        }
    });
    const messagesSize = _.sumBy(Array.from(streamMessages), (messages) =>
        _.sumBy(messages, (message) => MESSAGE_OVERHEAD_ESTIMATE + (message.isBinary
            ? getBase64Size(message.content.byteLength)
            : message.content.byteLength
        ))
    );

    return {
        totalSize: _.sumBy(httpBodies, 'size') + messagesSize + events.length * ITEM_OVERHEAD_ESTIMATE,
        httpBodies
    };
}

export type BulkHarExportPlan<B = MessageBody> =
    | { kind: 'export', droppedBodies: Set<B> }
    | { kind: 'too-large' };

export function planBulkHarExport<B>(
    { totalSize, httpBodies }: HarSizeEstimate<B>
): BulkHarExportPlan<B> {
    const droppedBodies = new Set<B>();
    let remainingSize = totalSize;

    for (const { body, size } of _.sortBy(httpBodies, ({ size }) => -size)) {
        if (remainingSize <= HAR_SIZE_WARNING_LIMIT || size === 0) break;
        droppedBodies.add(body);
        remainingSize -= size;
    }

    return remainingSize > HAR_SIZE_MAX_LIMIT
        ? { kind: 'too-large' }
        : { kind: 'export', droppedBodies };
}

// Checks the likely size of a multi-item export, confirming with the user before dropping
// large bodies. Resolves with undefined if the export should not go ahead.
export async function getBulkHarExportOptions(
    events: ReadonlyArray<ViewableEvent>
): Promise<HarGenerationOptions | undefined> {
    const plan = planBulkHarExport(await estimateHarSize(events));

    if (plan.kind === 'too-large') {
        // Only possible once all HTTP bodies are dropped, so this is message data or sheer volume:
        alert(dedent`
            This HAR export is likely to be over ${HAR_SIZE_MAX_LIMIT / MB}MB, even if all message bodies were excluded to reduce the size.

            To export a usable HAR file, filter the list of data before exporting, or export events individually.
        `);
        return undefined;
    }

    if (plan.droppedBodies.size && !confirm(dedent`
        This HAR export is likely to be over ${HAR_SIZE_WARNING_LIMIT / MB}MB, which may cause compatibility problems.

        Press OK to drop the largest message bodies, and export the rest, or press Cancel and use the \`bodySize\` filter
        to select a set of smaller messages instead.
    `)) return undefined;

    return { droppedBodies: plan.droppedBodies };
}

const saveHar = async (
    events: ReadonlyArray<ViewableEvent>,
    filename: string,
    options: HarGenerationOptions
) => {
    const harContent = JSON.stringify(await generateHar(events, options));
    saveFile(filename, 'application/har+json;charset=utf-8', harContent);
};

export const exportEventsAsBulkHar = async (
    events: ReadonlyArray<ViewableEvent>,
    filename: string
) => {
    const options = await getBulkHarExportOptions(events);
    if (options) await saveHar(events, filename, options);
};

// Exports a single explicitly selected item in full. If that's too large,
// tooLargeHint should suggest another way to save it.
export const exportEventsAsHar = async (
    events: ReadonlyArray<ViewableEvent>,
    filename: string,
    tooLargeHint: string
) => {
    const { totalSize } = await estimateHarSize(events);
    if (totalSize > HAR_SIZE_MAX_LIMIT) {
        alert(`This is likely to be over ${HAR_SIZE_MAX_LIMIT / MB}MB, which is too large to export as a usable HAR file.\n\n${tooLargeHint}`);
        return;
    }

    await saveHar(events, filename, {});
};

export const exportHar = (exchange: HttpExchangeView) =>
    exportEventsAsHar([exchange], `${
        exchange.request.method
    } ${
        exchange.request.parsedUrl.hostname
    }.har`, 'To export very large bodies, use the save button on the message body directly instead.');

export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding: true }
): Promise<string>;
export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options?: { waitForBodyDecoding?: boolean }
): string;
export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding?: boolean } = {}
): string | Promise<string> {
    // If the body isn't decoded yet, and it should be, wait for that decoding first.
    if (options.waitForBodyDecoding && exchange.request.body.isPending()) {
        // Doesn't matter if this errors - we'll make that explicit in the export later.
        return exchange.request.body.waitForDecoding().catch(() => {})
            .then(() => generateCodeSnippet(exchange, snippetFormat, options));
    }

    // First, we need to get a HAR that appropriately represents this request as we
    // want to export it:
    const harRequest = generateHarRequest(exchange.request, false, {});

    return generateCodeSnippetFromHarRequest(harRequest, snippetFormat);
};

// Generates a code snippet for a not-yet-sent request input, e.g. while editing
// a request on the Send page. We build the same HtkRequest a real send would produce,
// so this goes through exactly the same HAR generation as exported captured requests.
export function generateCodeSnippetFromRequestInput(
    requestInput: RequestInput,
    snippetFormat: SnippetOption
): string {
    const decoded = requestInput.rawBody.decoded;
    const sentRequest = buildSentExchangeRequest(requestInput, {
        encodedLength: decoded.byteLength,
        decoded
    });

    const harRequest = generateHarRequest(buildHtkRequest(sentRequest), false, {});

    return generateCodeSnippetFromHarRequest(harRequest, snippetFormat);
};

function generateCodeSnippetFromHarRequest(
    harRequest: ExtendedHarRequest,
    snippetFormat: SnippetOption
): string {
    // All snippet-specific preprocessing (header filtering, body placeholders) lives in
    // snippet-export-sanitization.ts, so that this export and the bulk ZIP export share
    // identical behaviour:
    const harSnippetBase = simplifyHarRequestForSnippetExport(harRequest);

    // We convert the HAR to code for the given target:
    return new HTTPSnippet(harSnippetBase)
        .convert(snippetFormat.target, snippetFormat.client)
        .trim();
};
