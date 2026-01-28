import * as Mockttp from 'mockttp';
import * as serializr from 'serializr';
import { observable } from 'mobx';
import * as HarFormat from 'har-format';

import { HttpExchange, RawHeaders, HttpExchangeView } from "../../types";
import { ObservablePromise } from '../../util/observable';

import { EditableContentType, getEditableContentType, getEditableContentTypeFromViewable } from "../events/content-types";
import { EditableBody } from '../http/editable-body';
import {
    syncBodyToContentLength,
    syncFormattingToContentType,
    syncUrlToHeaders
} from '../http/editable-request-parts';
import { getHeaderValue, h2HeadersToH1 } from '../http/headers';
import { parseHarRequest } from '../http/har';

// This is our model of a Request for sending. Smilar to the API model,
// but not identical, as we add extra UI metadata etc.
export class RequestInput {

    @observable
    public method = 'GET';

    @observable
    public url = '';

    @observable
    public headers: RawHeaders = [];

    @observable
    public requestContentType: EditableContentType = 'text';

    @observable
    public rawBody: EditableBody;

    constructor(
        existingData?: {
            method: string,
            url: string,
            headers: RawHeaders,
            requestContentType: EditableContentType,
            rawBody: Buffer | EditableBody
        }
    ) {
        // When deserializing, we need to ensure the body is provided directly
        // in the constructor, before model syncing is initialized.
        if (existingData) {
            this.method = existingData.method;
            this.url = existingData.url;
            this.headers = existingData.headers;
            this.requestContentType = existingData.requestContentType;

            const rawBody = existingData.rawBody instanceof EditableBody
                ? existingData.rawBody.decoded
                : existingData.rawBody;

            this.rawBody = new EditableBody(
                rawBody,
                undefined,
                () => this.headers
            );
        } else {
            this.rawBody = new EditableBody(
                Buffer.from([]),
                undefined,
                () => this.headers
            );
        }

        syncUrlToHeaders(() => this.url, () => this.headers);
        syncBodyToContentLength(this.rawBody, () => this.headers);
        syncFormattingToContentType(
            () => this.headers,
            () => this.requestContentType,
            (contentType) => { this.requestContentType = contentType }
        );
    }

}

export interface SendRequest {
    id: string;
    request: RequestInput;
    sentExchange: HttpExchange | undefined;
    pendingSend?: {
        promise: ObservablePromise<void>,
        abort: () => void
    }
}

const requestInputSchema = serializr.createModelSchema(RequestInput, {
    method: serializr.primitive(),
    url: serializr.primitive(),
    headers: serializr.list(serializr.list(serializr.primitive())),
    requestContentType: serializr.primitive(),

    rawBody: serializr.custom(
        (body: EditableBody) => body.decoded.toString('base64'),
        () => serializr.SKIP // Handled manually in the factory below
    )
}, (context) => {
    const data = context.json;
    const bodyData = Buffer.from(data.rawBody, 'base64');
    return new RequestInput({
        ...data,
        rawBody: bodyData
    });
});

export const sendRequestSchema = serializr.createSimpleSchema({
    id: serializr.primitive(),
    request: serializr.object(requestInputSchema),
    sentExchange: false, // Never persisted here (exportable as HAR etc though)
    pendingSend: false // Never persisted at all
});

export async function buildRequestInputFromExchange(exchange: HttpExchangeView): Promise<RequestInput> {
    const body = await exchange.request.body.waitForDecoding() ??
        Buffer.from('!!! ORIGINAL REQUEST BODY COULD NOT BE DECODED !!!');

    // For now, all sent requests are HTTP/1, so we need to make sure we convert:
    const headers = exchange.httpVersion >= 2
        ? h2HeadersToH1(exchange.request.rawHeaders, exchange.request.method)
        : exchange.request.rawHeaders;

    return new RequestInput({
        method: exchange.request.method,
        url: exchange.request.url,
        headers: headers,
        requestContentType: getEditableContentTypeFromViewable(exchange.request.contentType) ?? 'text',
        rawBody: body,
    });
}

export function buildRequestInputFromHarRequest(requestData: HarFormat.Request): RequestInput {
    const harRequest = parseHarRequest('', requestData, {} as any);

    let headers = harRequest.rawHeaders;
    if (parseInt(harRequest.httpVersion.split('.')[0], 10) >= 2) {
        headers = h2HeadersToH1(headers, harRequest.method);
    }

    return new RequestInput({
        method: harRequest.method,
        url: harRequest.url,
        headers: headers,
        requestContentType: getEditableContentType(
            getHeaderValue(harRequest.headers, 'content-type')
            ?? 'application/octet-stream'
        ) ?? 'text',
        rawBody: harRequest.body.decoded
    });
}

// These are the types that the sever client API expects. They are _not_ the same as
// the Input type above, which is more flexible and includes various UI concerns that
// we don't need to share with the server to actually send the request.
export interface RequestDefinition {
    method: string;
    url: string;
    headers: RawHeaders;
    rawBody?: Buffer;
}

export interface RequestOptions {
    ignoreHostHttpsErrors?: string[] | boolean;
    additionalTrustedCAs?: Array<{ cert: string }>;
    /** @deprecated alias for additionalTrustedCAs */
    trustAdditionalCAs?: Array<{ cert: string }>;
    clientCertificate?: { pfx: Buffer, passphrase?: string };
    proxyConfig?: ClientProxyConfig;
    lookupOptions?: { servers?: string[] };
    keyLogFile?: string;
}

export const RULE_PARAM_REF_KEY = '__rule_param_reference__';
type ClientProxyRuleParamReference = { [RULE_PARAM_REF_KEY]: string };

export type ClientProxyConfig =
    | undefined // No Docker, no user or system proxy
    | Mockttp.ProxySetting // User or system proxy
    | ClientProxyRuleParamReference // Docker proxy (must be dereferenced)
    | Array<Mockttp.ProxySetting | ClientProxyRuleParamReference> // Both, ordered