import * as _ from 'lodash';
import * as React from 'react';
import { action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';
import { WithInjected } from '../../types';

import { ActivatedStore } from '../../model/interception-store';
import { getNewRule } from '../../model/rules/rules';

import { Button } from '../common/inputs';
import { AddRuleRow, RuleRow } from './rule-row';

interface MockPageProps {
    className?: string,
    interceptionStore: ActivatedStore,
}

const MockPageContainer = styled.section`
    height: 100%;
    overflow-y: auto;
    position: relative;

    max-width: 1200px;
    margin: 0 auto;
    padding: 40px;
`;

const MockPageHeader = styled.header`
    width: 100%;
    margin-bottom: 40px;

    display: flex;
    flex-direction: row;
    align-items: center;
`;

const MockHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
`;

const SaveButton = styled(Button)`
    margin-left: auto;
    padding: 10px 24px;
    font-weight: bold;

    font-size: ${p => p.theme.textSize};
`;

const MockRuleList = styled.ol`
`;

@inject('interceptionStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    render(): JSX.Element {
        const {
            unsavedInterceptionRules,
            areSomeRulesUnsaved,
            saveInterceptionRules
        } = this.props.interceptionStore;

        return <MockPageContainer>
            <MockPageHeader>
                <MockHeading>Mock & Rewrite HTTP</MockHeading>
                <SaveButton disabled={!areSomeRulesUnsaved} onClick={saveInterceptionRules}>
                    Save changes
                </SaveButton>
            </MockPageHeader>

            <MockRuleList>
                <AddRuleRow onClick={action(() => {
                    unsavedInterceptionRules.unshift(getNewRule());
                })} />

                { unsavedInterceptionRules.map((rule, i) =>
                    <RuleRow
                        key={rule.id}
                        rule={rule}
                        deleteRule={() => this.deleteRule(i)}
                    />
                ) }
            </MockRuleList>
        </MockPageContainer>
    }

    @action.bound
    deleteRule(ruleIndex: number) {
        this.props.interceptionStore.unsavedInterceptionRules.splice(ruleIndex, 1);
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedMockPage = MockPage as unknown as WithInjected<
    typeof MockPage,
    'interceptionStore'
>;
export { InjectedMockPage as MockPage };