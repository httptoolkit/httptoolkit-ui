import * as Mockttp from 'mockttp';
import * as serializr from 'serializr';
import { observable } from 'mobx';

import { HttpExchange, RawHeaders } from "../../types";
import { ObservablePromise } from '../../util/observable';

import { EditableContentType, getEditableContentTypeFromViewable } from "../events/content-types";
import { EditableBody } from '../http/editable-body';
import {
    syncBodyToContentLength,
    syncFormattingToContentType,
    syncUrlToHeaders
} from '../http/editable-request-parts';

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
            rawBody: Buffer
        }
    ) {
        // When deserializing, we need to ensure the body is provided directly
        // in the constructor, before model syncing is initialized.
        if (existingData) {
            this.method = existingData.method;
            this.url = existingData.url;
            this.headers = existingData.headers;
            this.requestContentType = existingData.requestContentType;
            this.rawBody = new EditableBody(
                existingData.rawBody,
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

export async function buildRequestInputFromExchange(exchange: HttpExchange): Promise<RequestInput> {
    const body = await exchange.request.body.decodedPromise ??
        Buffer.from('!!! ORIGINAL REQUEST BODY COULD NOT BE DECODED !!!');

    return new RequestInput({
        method: exchange.request.method,
        url: exchange.request.url,
        headers: exchange.request.rawHeaders,
        requestContentType: getEditableContentTypeFromViewable(exchange.request.contentType) ?? 'text',
        rawBody: body,
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
    trustAdditionalCAs?: Array<{ cert: string }>;
    clientCertificate?: { pfx: Buffer, passphrase?: string };
    proxyConfig?: ClientProxyConfig;
    lookupOptions?: { servers?: string[] };
}

export const RULE_PARAM_REF_KEY = '__rule_param_reference__';
type ClientProxyRuleParamReference = { [RULE_PARAM_REF_KEY]: string };

export type ClientProxyConfig =
    | undefined // No Docker, no user or system proxy
    | Mockttp.ProxySetting // User or system proxy
    | ClientProxyRuleParamReference // Docker proxy (must be dereferenced)
    | Array<Mockttp.ProxySetting | ClientProxyRuleParamReference> // Both, ordered