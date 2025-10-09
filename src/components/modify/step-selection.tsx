import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../styles';
import { UnreachableCheck } from '../../util/error';

import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';
import {
    StepClass,
    Step,
    AvailableStepKey,
    StepClassKeyLookup,
    isPaidStepClass,
    RuleType,
} from '../../model/rules/rules';
import { summarizeStepClass } from '../../model/rules/rule-descriptions';
import {
    StaticResponseStep,
    ForwardToHostStep,
    TransformingStep,
    RequestBreakpointStep,
    ResponseBreakpointStep,
    RequestAndResponseBreakpointStep,
    PassThroughStep,
    TimeoutStep,
    CloseConnectionStep,
    ResetConnectionStep,
    FromFileResponseStep,
    WebhookStep,
    DelayStep
} from '../../model/rules/definitions/http-rule-definitions';
import {
    WebSocketPassThroughStep,
    EchoWebSocketStep,
    RejectWebSocketStep,
    ListenWebSocketStep,
    WebSocketForwardToHostStep
} from '../../model/rules/definitions/websocket-rule-definitions';
import {
    EthereumCallResultStep,
    EthereumNumberResultStep,
    EthereumHashResultStep,
    EthereumReceiptResultStep,
    EthereumBlockResultStep,
    EthereumErrorStep
} from '../../model/rules/definitions/ethereum-rule-definitions';
import {
    IpfsCatTextStep,
    IpfsCatFileStep,
    IpfsAddResultStep,
    IpnsResolveResultStep,
    IpnsPublishResultStep,
    IpfsPinsResultStep,
    IpfsPinLsResultStep
} from '../../model/rules/definitions/ipfs-rule-definitions';
import {
    DynamicProxyStep,
    EchoStep,
    CloseStep,
    WaitForMediaStep,
    WaitForDurationStep,
    WaitForChannelStep,
    WaitForMessageStep,
    CreateChannelStep,
    SendStep
} from '../../model/rules/definitions/rtc-rule-definitions';

import { Select } from '../common/inputs';
import { trackEvent } from '../../metrics';

const getStepKey = (h: StepClass | Step) =>
    StepClassKeyLookup.get(h as any) || StepClassKeyLookup.get(h.constructor as any);

const StepOptions = (p: { steps: Array<StepClass> }) => <>{
    p.steps.map((step): JSX.Element | null => {
        const key = getStepKey(step)!;
        const description = summarizeStepClass(key);

        return <option key={key} value={key}>
            { description }
        </option>;
    })
}</>;

const StepSelect = styled(Select)`
    &:not(:first-of-type) {
        margin-top: 10px;
    }
`;

const instantiateStep = (
    stepKey: AvailableStepKey,
    rulesStore: RulesStore
): Step => {
    switch (stepKey) {
        case 'simple':
            return new StaticResponseStep(200);
        case 'file':
            return new FromFileResponseStep(200, undefined, '');
        case 'passthrough':
            return new PassThroughStep(rulesStore);
        case 'forward-to-host':
            return new ForwardToHostStep(undefined, '', true, rulesStore);
        case 'req-res-transformer':
            return new TransformingStep(rulesStore, {}, {});
        case 'request-breakpoint':
            return new RequestBreakpointStep(rulesStore);
        case 'response-breakpoint':
            return new ResponseBreakpointStep(rulesStore);
        case 'request-and-response-breakpoint':
            return new RequestAndResponseBreakpointStep(rulesStore);
        case 'delay':
            return new DelayStep(0);
        case 'timeout':
            return new TimeoutStep();
        case 'close-connection':
            return new CloseConnectionStep();
        case 'reset-connection':
            return new ResetConnectionStep();
        case 'webhook':
            return new WebhookStep('http://', ['request', 'response']);

        case 'ws-passthrough':
            return new WebSocketPassThroughStep(rulesStore);
        case 'ws-forward-to-host':
            return new WebSocketForwardToHostStep(undefined, '', true, rulesStore);
        case 'ws-echo':
            return new EchoWebSocketStep();
        case 'ws-reject':
            return new RejectWebSocketStep(400);
        case 'ws-listen':
            return new ListenWebSocketStep();

        case 'eth-call-result':
            return new EthereumCallResultStep([], []);
        case 'eth-number-result':
            return new EthereumNumberResultStep(0);
        case 'eth-hash-result':
            return new EthereumHashResultStep('0x0');
        case 'eth-receipt-result':
            return new EthereumReceiptResultStep(undefined);
        case 'eth-block-result':
            return new EthereumBlockResultStep(undefined);
        case 'eth-error':
            return new EthereumErrorStep('Unknown Error');

        case 'ipfs-cat-text':
            return new IpfsCatTextStep('');
        case 'ipfs-cat-file':
            return new IpfsCatFileStep('');
        case 'ipfs-add-result':
            return new IpfsAddResultStep();
        case 'ipns-resolve-result':
            return new IpnsResolveResultStep();
        case 'ipns-publish-result':
            return new IpnsPublishResultStep();
        case 'ipfs-pins-result':
            return new IpfsPinsResultStep();
        case 'ipfs-pin-ls-result':
            return new IpfsPinLsResultStep();

        case 'rtc-dynamic-proxy':
            return new DynamicProxyStep();
        case 'echo-rtc':
            return new EchoStep();
        case 'close-rtc-connection':
            return new CloseStep();
        case 'wait-for-rtc-media':
            return new WaitForMediaStep();
        case 'wait-for-duration':
            return new WaitForDurationStep(0);
        case 'wait-for-rtc-data-channel':
            return new WaitForChannelStep();
        case 'wait-for-rtc-message':
            return new WaitForMessageStep();
        case 'create-rtc-data-channel':
            return new CreateChannelStep('mock-channel');
        case 'send-rtc-data-message':
            return new SendStep(undefined, '');

        default:
            throw new UnreachableCheck(stepKey);
    }
}

export const StepSelector = inject('rulesStore', 'accountStore')(observer((p: {
    rulesStore?: RulesStore,
    accountStore?: AccountStore,
    ruleType: RuleType,
    availableSteps: Array<StepClass>,
    value: Step,
    stepIndex: number,
    onChange: (step: Step) => void
}) => {
    let [ allowedSteps, needProSteps ] = _.partition(
        p.availableSteps,
        (stepClass) => p.accountStore!.isPaidUser || !isPaidStepClass(p.ruleType, stepClass)
    );

    // Pull the breakpoint steps to the top, since they're kind of separate
    allowedSteps = _.sortBy(allowedSteps, h =>
        getStepKey(h)!.includes('breakpoint') ? 0 : 1
    );

    return <StepSelect
        aria-label={
            p.stepIndex === 0
            ? "Select how matching requests should be handled"
            : "Select the next step in how matching requests should be handled"
        }
        value={getStepKey(p.value)}
        onChange={(event) => {
            const stepKey = event.target.value as AvailableStepKey;
            // Roughly track which types of steps are most used:
            trackEvent({
                category: 'Modify',
                action: 'Step Selected',
                value: stepKey
            });
            const step = instantiateStep(stepKey, p.rulesStore!);
            p.onChange(step);
        }}
    >
        <StepOptions steps={allowedSteps} />
        { needProSteps.length &&
            <optgroup label='With HTTP Toolkit Pro:'>
                <StepOptions steps={needProSteps} />
            </optgroup>
        }
    </StepSelect>
}));