import * as Mockttp from 'mockttp';
import * as serializr from 'serializr';
import { observable } from 'mobx';

import { RawHeaders } from "../../types";
import { EditableContentType } from "../events/content-types";
import { EditableBody } from '../http/editable-body';
import { syncBodyToContentLength, syncFormattingToContentType, syncUrlToHeaders } from '../http/editable-request-parts';

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
    public rawBody: EditableBody = new EditableBody(
        Buffer.from([]),
        undefined,
        () => this.headers
    )

    constructor(existingBodyData?: Buffer) {
        // When deserializing, we need to ensure the body is provided directly
        // in the constructor, before model syncing is initialized.
        if (existingBodyData) {
            this.rawBody = new EditableBody(
                existingBodyData,
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

export const requestInputSchema = serializr.createModelSchema(RequestInput, {
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
    return new RequestInput(bodyData);
});

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