import _ from 'lodash';
import {
    matchers,
    completionCheckers,
    RequestRuleData
} from 'mockttp';
import {
    HttpHandlerLookup
} from './http-rule-definitions';

export const EthereumMethods = {
    'eth_call': 'Call a contract method (without a transaction)',
    'eth_sendRawTransaction': 'Submit a signed transaction',
    'eth_sendTransaction': 'Submit an unsigned transaction',
    'eth_getTransactionReceipt': 'Return the receipt of a submitted transaction',
    'eth_getBalance': 'Return the balance of an account',
    'eth_gasPrice': 'Return the current gas price',
    'eth_blockNumber': 'Return the latest block number',
    'eth_getBlockByNumber': 'Return information about a block by number',
    'eth_getBlockByHash': 'Return information about a block by hash'
};

export type EthereumMethod = keyof typeof EthereumMethods;

export class EthereumMethodMatcher extends matchers.JsonBodyFlexibleMatcher {

    readonly uiType = 'ethereum-method';

    constructor(
        public readonly methodName: EthereumMethod = 'eth_call'
    ) {
        super({
            jsonrpc: '2.0',
            method: methodName
        });
    }

    explain() {
        return `Ethereum ${this.methodName} requests`;
    }

}

export const EthereumMatcherLookup = {
    'ethereum-method': EthereumMethodMatcher, // N.b. this is JSON-RPC method, not HTTP method

    // The subset of relevant HTTP matchers:
    'protocol': matchers.ProtocolMatcher,
    'host': matchers.HostMatcher,
    'hostname': matchers.HostnameMatcher,
    'port': matchers.PortMatcher,
    'simple-path': matchers.SimplePathMatcher,
    'regex-path': matchers.RegexPathMatcher,
    'header': matchers.HeaderMatcher,
    'query': matchers.QueryMatcher,
    'exact-query-string': matchers.ExactQueryMatcher,
    'cookie': matchers.CookieMatcher
};

export const EthereumInitialMatcherClasses = [
    EthereumMethodMatcher
];

export const EthereumHandlerLookup = {
    'passthrough': HttpHandlerLookup['passthrough'],
    'forward-to-host': HttpHandlerLookup['forward-to-host'],
    'timeout': HttpHandlerLookup['timeout'],
    'close-connection': HttpHandlerLookup['close-connection']
};

type EthereumMatcherClass = typeof EthereumMatcherLookup[keyof typeof EthereumMatcherLookup];
export type EthereumMatcher = InstanceType<EthereumMatcherClass>;
export type EthereumInitialMatcher = InstanceType<typeof EthereumInitialMatcherClasses[number]>;

type EthereumHandlerClass = typeof EthereumHandlerLookup[keyof typeof EthereumHandlerLookup];
type EthereumHandler = InstanceType<EthereumHandlerClass>;

export interface EthereumMockRule extends Omit<RequestRuleData, 'matchers'> {
    id: string;
    type: 'ethereum';
    activated: boolean;
    matchers: Array<EthereumMatcher> & { 0?: EthereumMethodMatcher };
    handler: EthereumHandler;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
}