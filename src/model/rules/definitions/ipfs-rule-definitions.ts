/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.tech>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import _ from 'lodash';
import {
    matchers,
    completionCheckers,
    RequestRuleData
} from 'mockttp';
import * as serializr from 'serializr';

import { byteLength } from '../../../util';
import {
    HttpHandlerLookup
} from './http-rule-definitions';

export const IpfsInteractions = {
    'cat': "Read IPFS content",
    'add': 'Add a file or directory to IPFS',
    'name/resolve': 'Resolve an IPNS name',
    'name/publish': 'Publish an IPNS name',
    'pin/add': 'Pin some IPFS content',
    'pin/rm': 'Unpin some IPFS content',
    'pin/ls': 'List the pinned IPFS content'
};

export type IpfsInteraction = keyof typeof IpfsInteractions;

export class IpfsInteractionMatcher extends matchers.SimplePathMatcher {

    readonly uiType = 'ipfs-interaction';

    constructor(
        public readonly interactionName: IpfsInteraction = 'cat',
    ) {
        super(`/api/v0/${interactionName}`);
    }

    explain() {
        return `IPFS ${this.interactionName} requests`;
    }

}

export const IpfsArgDescription: {
    [I in IpfsInteraction]?: { argType: string, placeholder: string }
} = {
    'cat': {
        argType: 'IPFS path',
        placeholder: 'The path to the IPFS object(s) to be read'
    },
    'name/resolve': {
        // ^ Technically not required, but very unusual to not specify I think
        argType: 'IPNS name',
        placeholder: 'The IPNS name to resolve'
    },
    'name/publish': {
        argType: 'IPFS path',
        placeholder: 'The IPFS path of the object to be published'
    },
    'pin/add': {
        argType: 'IPFS path',
        placeholder: 'The IPFS path to the object(s) to be pinned',
    },
    'pin/rm': {
        argType: 'IPFS path',
        placeholder: 'The IPFS path to the object(s) to be unpinned'
    }
};

export const shouldSuggestArgMatcher = (interaction: IpfsInteraction) =>
    Object.keys(IpfsArgDescription).includes(interaction);

export class IpfsArgMatcher extends matchers.QueryMatcher {

    readonly uiType = 'ipfs-arg';

    constructor(
        public readonly interaction: IpfsInteraction,
        public readonly argValue: string | undefined = undefined,
    ) {
        super(argValue ? { arg: argValue } : {});
    }

    explain() {
        return `for ${
            this.argValue
            ?? `any ${IpfsArgDescription[this.interaction]?.argType ?? 'value'}`
        }`;
    }

}

const buildIpfsFixedValueDefaultHeaders = (body?: string | Buffer) => ({
    'cache-control': 'no-cache',
    'connection': 'close',
    'date': new Date().toUTCString(),
    'content-type': 'application/json; charset=utf-8',
    ...(body !== undefined
        ? { 'content-length': byteLength(body).toString() }
        : {}
    )
});

export class IpfsCatTextHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipfs-cat-text';

    constructor(
        public readonly data: string | Buffer
    ) {
        super(
            200,
            undefined,
            data,
            buildIpfsFixedValueDefaultHeaders(data)
        );
    }

    explain() {
        return `Return fixed IPFS content`;
    }

}

// Need to provide a schema to avoid this being deserialized using StaticResponseHandler's explicit
// schema, which is required to handle buffers nicely, but results in the wrong class for instances.
const simpleHandlerSchema = serializr.getDefaultModelSchema(HttpHandlerLookup['simple']);
serializr.createModelSchema(IpfsCatTextHandler, simpleHandlerSchema.props, () => new IpfsCatTextHandler(''));

export class IpfsCatFileHandler extends HttpHandlerLookup['file'] {

    readonly uiType = 'ipfs-cat-file';

    constructor(
        public readonly path: string
    ) {
        super(
            200,
            undefined,
            path,
            buildIpfsFixedValueDefaultHeaders()
        );
    }

    explain() {
        return `Return IPFS content from ${this.path || 'a file'}`;
    }

}

export const IpfsMatcherLookup = {
    'ipfs-interaction': IpfsInteractionMatcher,
    'ipfs-arg': IpfsArgMatcher,
    'query': matchers.QueryMatcher,
    'exact-query-string': matchers.ExactQueryMatcher,

    // The subset of relevant HTTP matchers:
    'protocol': matchers.ProtocolMatcher,
    'host': matchers.HostMatcher,
    'hostname': matchers.HostnameMatcher,
    'port': matchers.PortMatcher,
    'header': matchers.HeaderMatcher,
    'cookie': matchers.CookieMatcher
};

export const IpfsInitialMatcherClasses = [
    IpfsInteractionMatcher
];

export const IpfsHandlerLookup = {
    'ipfs-cat-text': IpfsCatTextHandler,
    'ipfs-cat-file': IpfsCatFileHandler,

    'passthrough': HttpHandlerLookup['passthrough'],
    'forward-to-host': HttpHandlerLookup['forward-to-host'],
    'timeout': HttpHandlerLookup['timeout'],
    'close-connection': HttpHandlerLookup['close-connection']
};

type IpfsMatcherClass = typeof IpfsMatcherLookup[keyof typeof IpfsMatcherLookup];
export type IpfsMatcher = InstanceType<IpfsMatcherClass>;
export type IpfsInitialMatcher = InstanceType<typeof IpfsInitialMatcherClasses[number]>;

type IpfsHandlerClass = typeof IpfsHandlerLookup[keyof typeof IpfsHandlerLookup];
type IpfsHandler = InstanceType<IpfsHandlerClass>;

export interface IpfsMockRule extends Omit<RequestRuleData, 'matchers'> {
    id: string;
    type: 'ipfs';
    activated: boolean;
    matchers: Array<IpfsMatcher> & { 0?: IpfsInteractionMatcher };
    handler: IpfsHandler;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
}