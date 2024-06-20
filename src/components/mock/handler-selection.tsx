import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../styles';
import { UnreachableCheck } from '../../util/error';

import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';
import {
    HandlerClass,
    Handler,
    AvailableHandlerKey,
    HandlerClassKeyLookup,
    isPaidHandlerClass,
    RuleType,
} from '../../model/rules/rules';
import { summarizeHandlerClass } from '../../model/rules/rule-descriptions';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    TransformingHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    PassThroughHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    ResetConnectionHandler,
    FromFileResponseHandler
} from '../../model/rules/definitions/http-rule-definitions';
import {
    WebSocketPassThroughHandler,
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition,
    WebSocketForwardToHostHandler
} from '../../model/rules/definitions/websocket-rule-definitions';
import {
    EthereumCallResultHandler,
    EthereumNumberResultHandler,
    EthereumHashResultHandler,
    EthereumReceiptResultHandler,
    EthereumBlockResultHandler,
    EthereumErrorHandler
} from '../../model/rules/definitions/ethereum-rule-definitions';
import {
    IpfsCatTextHandler,
    IpfsCatFileHandler,
    IpfsAddResultHandler,
    IpnsResolveResultHandler,
    IpnsPublishResultHandler,
    IpfsPinsResultHandler,
    IpfsPinLsResultHandler
} from '../../model/rules/definitions/ipfs-rule-definitions';
import {
    DynamicProxyStepDefinition,
    EchoStepDefinition,
    CloseStepDefinition,
    WaitForMediaStepDefinition,
    WaitForDurationStepDefinition,
    WaitForChannelStepDefinition,
    WaitForMessageStepDefinition,
    CreateChannelStepDefinition,
    SendStepDefinition
} from '../../model/rules/definitions/rtc-rule-definitions';

import { Select } from '../common/inputs';

const getHandlerKey = (h: HandlerClass | Handler) =>
    HandlerClassKeyLookup.get(h as any) || HandlerClassKeyLookup.get(h.constructor as any);

const HandlerOptions = (p: { handlers: Array<HandlerClass> }) => <>{
    p.handlers.map((handler): JSX.Element | null => {
        const key = getHandlerKey(handler)!;
        const description = summarizeHandlerClass(key);

        return <option key={key} value={key}>
            { description }
        </option>;
    })
}</>;

const HandlerSelect = styled(Select)`
    &:not(:first-of-type) {
        margin-top: 10px;
    }
`;

const instantiateHandler = (
    handlerKey: AvailableHandlerKey,
    rulesStore: RulesStore
): Handler => {
    switch (handlerKey) {
        case 'simple':
            return new StaticResponseHandler(200);
        case 'file':
            return new FromFileResponseHandler(200, undefined, '');
        case 'passthrough':
            return new PassThroughHandler(rulesStore);
        case 'forward-to-host':
            return new ForwardToHostHandler('', true, rulesStore);
        case 'req-res-transformer':
            return new TransformingHandler(rulesStore, {}, {});
        case 'request-breakpoint':
            return new RequestBreakpointHandler(rulesStore);
        case 'response-breakpoint':
            return new ResponseBreakpointHandler(rulesStore);
        case 'request-and-response-breakpoint':
            return new RequestAndResponseBreakpointHandler(rulesStore);
        case 'timeout':
            return new TimeoutHandler();
        case 'close-connection':
            return new CloseConnectionHandler();
        case 'reset-connection':
            return new ResetConnectionHandler();

        case 'ws-passthrough':
            return new WebSocketPassThroughHandler(rulesStore);
        case 'ws-forward-to-host':
            return new WebSocketForwardToHostHandler('', true, rulesStore);
        case 'ws-echo':
            return new EchoWebSocketHandlerDefinition();
        case 'ws-reject':
            return new RejectWebSocketHandlerDefinition(400);
        case 'ws-listen':
            return new ListenWebSocketHandlerDefinition();

        case 'eth-call-result':
            return new EthereumCallResultHandler([], []);
        case 'eth-number-result':
            return new EthereumNumberResultHandler(0);
        case 'eth-hash-result':
            return new EthereumHashResultHandler('0x0');
        case 'eth-receipt-result':
            return new EthereumReceiptResultHandler(undefined);
        case 'eth-block-result':
            return new EthereumBlockResultHandler(undefined);
        case 'eth-error':
            return new EthereumErrorHandler('Unknown Error');

        case 'ipfs-cat-text':
            return new IpfsCatTextHandler('');
        case 'ipfs-cat-file':
            return new IpfsCatFileHandler('');
        case 'ipfs-add-result':
            return new IpfsAddResultHandler();
        case 'ipns-resolve-result':
            return new IpnsResolveResultHandler();
        case 'ipns-publish-result':
            return new IpnsPublishResultHandler();
        case 'ipfs-pins-result':
            return new IpfsPinsResultHandler();
        case 'ipfs-pin-ls-result':
            return new IpfsPinLsResultHandler();

        case 'rtc-dynamic-proxy':
            return new DynamicProxyStepDefinition();
        case 'echo-rtc':
            return new EchoStepDefinition();
        case 'close-rtc-connection':
            return new CloseStepDefinition();
        case 'wait-for-rtc-media':
            return new WaitForMediaStepDefinition();
        case 'wait-for-duration':
            return new WaitForDurationStepDefinition(0);
        case 'wait-for-rtc-data-channel':
            return new WaitForChannelStepDefinition();
        case 'wait-for-rtc-message':
            return new WaitForMessageStepDefinition();
        case 'create-rtc-data-channel':
            return new CreateChannelStepDefinition('mock-channel');
        case 'send-rtc-data-message':
            return new SendStepDefinition(undefined, '');

        default:
            throw new UnreachableCheck(handlerKey);
    }
}

export const HandlerSelector = inject('rulesStore', 'accountStore')(observer((p: {
    rulesStore?: RulesStore,
    accountStore?: AccountStore,
    ruleType: RuleType,
    availableHandlers: Array<HandlerClass>,
    value: Handler,
    handlerIndex: number,
    onChange: (handler: Handler) => void
}) => {
    let [ allowedHandlers, needProHandlers ] = _.partition(
        p.availableHandlers,
        (handlerClass) => p.accountStore!.isPaidUser || !isPaidHandlerClass(p.ruleType, handlerClass)
    );

    // Pull the breakpoint handlers to the top, since they're kind of separate
    allowedHandlers = _.sortBy(allowedHandlers, h =>
        getHandlerKey(h)!.includes('breakpoint') ? 0 : 1
    );

    return <HandlerSelect
        aria-label={
            p.handlerIndex === 0
            ? "Select how matching requests should be handled"
            : "Select the next step in how matching requests should be handled"
        }
        value={getHandlerKey(p.value)}
        onChange={(event) => {
            const handlerKey = event.target.value as AvailableHandlerKey;
            const handler = instantiateHandler(handlerKey, p.rulesStore!);
            p.onChange(handler);
        }}
    >
        <HandlerOptions handlers={allowedHandlers} />
        { needProHandlers.length &&
            <optgroup label='With HTTP Toolkit Pro:'>
                <HandlerOptions handlers={needProHandlers} />
            </optgroup>
        }
    </HandlerSelect>
}));