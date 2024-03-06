/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import _ from 'lodash';
import {
    matchers,
    completionCheckers,
    RequestRuleData
} from 'mockttp';
import * as serializr from 'serializr';

import { byteLength } from '../../../util/buffer';
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

const buildIpfsStreamDefaultHeaders = () => ({
    'cache-control': 'no-cache',
    'connection': 'close',
    'date': new Date().toUTCString(),
    'content-type': 'application/json; charset=utf-8',
    'transfer-encoding': 'chunked',
    // 'trailer': 'X-Stream-Error',
    // ^ This is normally present but we skip it for now, since it causes issues with Node 18:
    // https://github.com/nodejs/undici/issues/1418
    'x-chunked-output': '1'
});

// When extending simple handlers, we need to provide a schema to avoid this being deserialized using
// StaticResponseHandler's explicit schema, which is required to handle buffers nicely, but results
// in the wrong class for the deserialized instances.
const simpleHandlerSchema = serializr.getDefaultModelSchema(HttpHandlerLookup['simple']);

export class IpfsCatTextHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipfs-cat-text';

    constructor(
        public readonly result: string | Buffer
    ) {
        super(
            200,
            undefined,
            result,
            buildIpfsFixedValueDefaultHeaders(result)
        );
    }

    explain() {
        return `Return fixed IPFS content`;
    }

}
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

export class IpfsAddResultHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipfs-add-result';

    constructor(
        public readonly result: Array<{ Name: string, Hash: string }> = [{
            Name: 'uploaded-file.txt',
            Hash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
        }]
    ) {
        super(
            200,
            undefined,
            result.map(json => JSON.stringify(json)).join('\n'),
            buildIpfsStreamDefaultHeaders()
        )
    }

    explain() {
        return `Return ${
            this.result.length === 0
                ? 'an empty'
                : 'fixed'
         } IPFS add result${
            this.result.length > 1
                ? 's'
                : ''
        }`;
    }

}

serializr.createModelSchema(IpfsAddResultHandler, simpleHandlerSchema.props, () => new IpfsAddResultHandler());

export class IpnsResolveResultHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipns-resolve-result';

    constructor(
        public readonly result: object = {
            Path: '/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
        }
    ) {
        super(
            200,
            undefined,
            JSON.stringify(result),
            buildIpfsFixedValueDefaultHeaders(JSON.stringify(result))
        )
    }

    explain() {
        return `Return a fixed IPNS resolved address`;
    }

}

serializr.createModelSchema(IpnsResolveResultHandler, simpleHandlerSchema.props, () => new IpnsResolveResultHandler());

export class IpnsPublishResultHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipns-publish-result';

    constructor(
        public readonly result: object = {
            Name: 'QmY7Yh4UquoXHLPFo2XbhXkhBvFoPwmQUSa92pxnxjQuPU',
            Value: '/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
        }
    ) {
        super(
            200,
            undefined,
            JSON.stringify(result),
            buildIpfsFixedValueDefaultHeaders(JSON.stringify(result))
        )
    }

    explain() {
        return `Return a fixed IPNS resolve result`;
    }

}

serializr.createModelSchema(IpnsPublishResultHandler, simpleHandlerSchema.props, () => new IpnsPublishResultHandler());

export class IpfsPinsResultHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipfs-pins-result';

    constructor(
        public readonly result: object = {
            Pins: [
                'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
            ]
        }
    ) {
        super(
            200,
            undefined,
            JSON.stringify(result),
            buildIpfsFixedValueDefaultHeaders(JSON.stringify(result))
        )
    }

    explain() {
        return `Return fixed IPFS pinning results`;
    }

}

serializr.createModelSchema(IpfsPinsResultHandler, simpleHandlerSchema.props, () => new IpfsPinsResultHandler());

export class IpfsPinLsResultHandler extends HttpHandlerLookup['simple'] {

    readonly uiType = 'ipfs-pin-ls-result';

    constructor(
        public readonly result: Array<{ Type: string, Cid: string }> = [
            { Type: 'direct', Cid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco' }
        ]
    ) {
        super(
            200,
            undefined,
            result.map(json => JSON.stringify(json)).join('\n'),
            buildIpfsStreamDefaultHeaders()
        )
    }

    explain() {
        return `Return fixed list of IPFS pins`;
    }

}

serializr.createModelSchema(IpfsPinLsResultHandler, simpleHandlerSchema.props, () => new IpfsPinLsResultHandler());

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
    'ipfs-add-result': IpfsAddResultHandler,
    'ipns-publish-result': IpnsPublishResultHandler,
    'ipns-resolve-result': IpnsResolveResultHandler,
    'ipfs-pins-result': IpfsPinsResultHandler,
    'ipfs-pin-ls-result': IpfsPinLsResultHandler,

    'passthrough': HttpHandlerLookup['passthrough'],
    'forward-to-host': HttpHandlerLookup['forward-to-host'],
    'timeout': HttpHandlerLookup['timeout'],
    'close-connection': HttpHandlerLookup['close-connection'],
    'request-breakpoint': HttpHandlerLookup['request-breakpoint'],
    'response-breakpoint': HttpHandlerLookup['response-breakpoint'],
    'request-and-response-breakpoint': HttpHandlerLookup['request-and-response-breakpoint']
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