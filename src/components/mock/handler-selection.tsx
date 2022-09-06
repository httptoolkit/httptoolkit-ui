import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../styles';

import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';
import {
    HandlerClass,
    Handler,
    HandlerClassKey,
    HandlerClassKeyLookup,
    HandlerLookup,
    isPaidHandlerClass
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

import { Select } from '../common/inputs';

const getHandlerKey = (h: HandlerClass | Handler) =>
    HandlerClassKeyLookup.get(h as any) || HandlerClassKeyLookup.get(h.constructor as any);
const getHandlerClassByKey = (k: HandlerClassKey) => HandlerLookup[k];

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
    handlerClass: HandlerClass,
    rulesStore: RulesStore
): Handler | undefined => {
    switch (handlerClass) {
        case StaticResponseHandler:
            return new StaticResponseHandler(200);
        case FromFileResponseHandler:
            return new FromFileResponseHandler(200, undefined, '');
        case PassThroughHandler:
            return new PassThroughHandler(rulesStore);
        case ForwardToHostHandler:
            return new ForwardToHostHandler('', true, rulesStore);
        case TransformingHandler:
            return new TransformingHandler(rulesStore, {}, {});
        case RequestBreakpointHandler:
            return new RequestBreakpointHandler(rulesStore);
        case ResponseBreakpointHandler:
            return new ResponseBreakpointHandler(rulesStore);
        case RequestAndResponseBreakpointHandler:
            return new RequestAndResponseBreakpointHandler(rulesStore);
        case TimeoutHandler:
            return new TimeoutHandler();
        case CloseConnectionHandler:
            return new CloseConnectionHandler();
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
            const handlerClass = getHandlerClassByKey(event.target.value as HandlerClassKey);
            const handler = instantiateHandler(handlerClass, p.rulesStore!);
            if (!handler) return;
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