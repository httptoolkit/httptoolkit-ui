import * as React from 'react';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';

import { styled } from '../../../styles';

import { ContentPerspective, UiStore } from '../../../model/ui/ui-store';
import { HandlerClassKey } from '../../../model/rules/rules';

import { PillSelect } from '../../common/pill';
import { MediumCard } from '../../common/card';
import { MatchedRulePill } from './matched-rule-pill';

const DropdownContainer = styled.div`
    display: inline-block;
    float: right;
    user-select: none;
`;

const PerspectivesDropdown = styled(PillSelect)`
    font-size: ${p => p.theme.textSize};
    padding: 1px 4px 1px 8px;
`;

const PerspectiveSelector = observer((p: {
    uiStore: UiStore
}) => {
    const onSelect = React.useCallback(action((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        p.uiStore.contentPerspective = value as ContentPerspective;
    }), [p.uiStore]);

    return <DropdownContainer>
        <PerspectivesDropdown onChange={onSelect} value={p.uiStore.contentPerspective}>
            <option value="transformed">Show transformed content</option>
            <option value="original">Show original content</option>
            <option value="client">Show the client's perspective</option>
            <option value="server">Show the server's perspective</option>
        </PerspectivesDropdown>
    </DropdownContainer>;
});

export const TransformCard = (p: {
    matchedRuleData?: {
        stepTypes: HandlerClassKey[],
        status: 'unchanged' | 'modified-types' | 'deleted'
    } | undefined,
    onRuleClicked: () => void,
    uiStore: UiStore
}) => {
    // We consider passthrough as a no-op, and so don't show anything in that case.
    const noopRule = p.matchedRuleData?.stepTypes.every(
        type => type === 'passthrough' || type === 'ws-passthrough'
    );

    // // Show nothing when there's no rule data available or the traffic was no-op'd
    if (noopRule || !p.matchedRuleData) return null;

    return <MediumCard>
        <MatchedRulePill
            ruleData={p.matchedRuleData!}
            onClick={p.onRuleClicked}
        />

        <PerspectiveSelector
            uiStore={p.uiStore}
        />
    </MediumCard>;
};