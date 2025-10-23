import * as React from 'react';
import { inject } from 'mobx-react';

import { styled } from '../../../styles';
import { PhosphorIcon } from '../../../icons';

import { UiStore } from '../../../model/ui/ui-store';
import { nameStepClass } from '../../../model/rules/rule-descriptions';
import { StepClassKey } from '../../../model/rules/rules';
import { getSummaryColor } from '../../../model/events/categorization';

import { aOrAn, uppercaseFirst } from '../../../util/text';
import { PillButton } from '../../common/pill';

export interface MatchedRuleData {
    stepTypes: StepClassKey[];
    status: 'unchanged' | 'modified-types' | 'deleted';
}

export const MatchedRulePill = styled(inject('uiStore')((p: {
    className?: string,
    uiStore?: UiStore,
    ruleData: MatchedRuleData,
    onClick: () => void
}) => {
    const { stepTypes } = p.ruleData;
    const stepDescription = stepTypes.length !== 1
        ? 'multi-step'
        : nameStepClass(stepTypes[0]);

    return <PillButton
        color={getSummaryColor('mutative')} // Conceptually similar - we've modified traffic
        className={p.className}

        // For now we show modified as unchanged, but we could highlight this later:
        disabled={p.ruleData.status === 'deleted'}
        onClick={p.ruleData.status !== 'deleted' ? p.onClick : undefined}

        title={
            `This exchange was handled by ${
                aOrAn(stepDescription)
             } ${stepDescription} rule${
                p.ruleData.status === 'deleted'
                    ? ' which has since been deleted'
                : p.ruleData.status === 'modified-types'
                    ? ' (which has since been modified)'
                : ''
            }.${
                p.ruleData.status !== 'deleted'
                    ? '\nClick here to jump to the rule on the Modify page.'
                    : ''
            }`
        }
    >
        <PhosphorIcon icon='Pencil' size='16px' />
        { uppercaseFirst(stepDescription) }
    </PillButton>;
}))`
    margin-right: auto;

    text-decoration: none;
    word-spacing: 0;

    > svg {
        margin: -1px 5px 0 -1px;
    }
`;