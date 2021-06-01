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
    HandlerKeys,
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
} from '../../model/rules/rule-definitions';

import { Select } from '../common/inputs';
import {
    serverVersion,
    versionSatisfies,
    FROM_FILE_HANDLER_SERVER_RANGE,
    PASSTHROUGH_TRANSFORMS_RANGE
} from '../../services/service-versions';

const getHandlerKey = (h: HandlerClass | Handler) =>
    HandlerKeys.get(h as any) || HandlerKeys.get(h.constructor as any);
const getHandlerClassByKey = (k: HandlerClassKey) => HandlerLookup[k];

const HandlerOptions = (p: { handlers: Array<HandlerClass> }) => <>{
    p.handlers.map((handler): JSX.Element | null => {
        const key = getHandlerKey(handler);
        const description = summarizeHandlerClass(handler);

        return description
            ? <option key={key} value={key}>
                { description }
            </option>
            : null;
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

const supportsFileHandlers = () =>
    _.isString(serverVersion.value) &&
    versionSatisfies(serverVersion.value, FROM_FILE_HANDLER_SERVER_RANGE);

const supportsTransforms = () =>
    _.isString(serverVersion.value) &&
    versionSatisfies(serverVersion.value, PASSTHROUGH_TRANSFORMS_RANGE);

export const HandlerSelector = inject('rulesStore', 'accountStore')(observer((p: {
    rulesStore?: RulesStore,
    accountStore?: AccountStore,
    value: Handler,
    onChange: (handler: Handler) => void
}) => {
    const allHandlers = [
        StaticResponseHandler,
        supportsFileHandlers() && FromFileResponseHandler,
        PassThroughHandler,
        ForwardToHostHandler,
        supportsTransforms() && TransformingHandler,
        RequestBreakpointHandler,
        ResponseBreakpointHandler,
        RequestAndResponseBreakpointHandler,
        TimeoutHandler,
        CloseConnectionHandler
    ].filter(Boolean);

    // Do some type tricks to make TS understand that we've filtered 'false' out of the handlers.
    type DefinedHandler = Exclude<typeof allHandlers[number], false>;

    const [ availableHandlers, needProHandlers ] = _.partition<DefinedHandler>(
        allHandlers as DefinedHandler[],
        (handlerClass) => p.accountStore!.isPaidUser || !isPaidHandlerClass(handlerClass)
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
        <HandlerOptions handlers={availableHandlers} />
        { needProHandlers.length &&
            <optgroup label='With HTTP Toolkit Pro:'>
                <HandlerOptions handlers={needProHandlers} />
            </optgroup>
        }
    </HandlerSelect>
}));