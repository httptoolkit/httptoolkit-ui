import * as Mockttp from 'mockttp';
import * as serializr from 'serializr';

import { RawHeaders } from "../../types";
import { EditableContentType } from "../events/content-types";

// This is our model of a Request for sending. Smilar to the API model,
// but not identical, as we add extra UI metadata etc.
export interface RequestInput {
    method: string;
    url: string;

    /**
     * The raw headers to send. These will be sent exactly as provided - no headers
     * will be added automatically.
     *
     * Note that this means omitting the 'Host' header may cause problems, as will
     * omitting both 'Content-Length' and 'Transfer-Encoding' on requests with
     * bodies.
     */
    headers: RawHeaders;

    requestContentType: EditableContentType;
    rawBody: Buffer;
}

// The schema to use to serialize the above as JSON.
export const requestInputSchema = serializr.createSimpleSchema({
    url: serializr.raw(),
    method: serializr.raw(),
    headers: serializr.raw(),
    requestContentType: serializr.raw(),
    // Serialize as Base64 - needs to be something we can put into JSON:
    rawBody: serializr.custom(
        (buffer) => buffer.toString('base64'),
        (base64Data) => Buffer.from(base64Data, 'base64')
    )
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