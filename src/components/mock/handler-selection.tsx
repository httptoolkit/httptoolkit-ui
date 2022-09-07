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
    FromFileResponseHandler
} from '../../model/rules/definitions/http-rule-definitions';
import {
    WebSocketPassThroughHandler,
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition
} from '../../model/rules/definitions/websocket-rule-definitions';

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
    margin-top: 20px;
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
        case 'ws-passthrough':
            return new WebSocketPassThroughHandler(rulesStore);
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
        case 'ws-echo':
            return new EchoWebSocketHandlerDefinition();
        case 'ws-reject':
            return new RejectWebSocketHandlerDefinition(400);
        case 'ws-listen':
            return new ListenWebSocketHandlerDefinition();
        default:
            throw new UnreachableCheck(handlerKey);
    }
}

export const HandlerSelector = inject('rulesStore', 'accountStore')(observer((p: {
    rulesStore?: RulesStore,
    accountStore?: AccountStore,
    availableHandlers: Array<HandlerClass>,
    value: Handler,
    onChange: (handler: Handler) => void
}) => {
    let [ allowedHandlers, needProHandlers ] = _.partition(
        p.availableHandlers,
        (handlerClass) => p.accountStore!.isPaidUser || !isPaidHandlerClass(handlerClass)
    );

    // Pull the breakpoint handlers to the top, since they're kind of separate
    allowedHandlers = _.sortBy(allowedHandlers, h =>
        getHandlerKey(h)!.includes('breakpoint') ? 0 : 1
    );

    return <HandlerSelect
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