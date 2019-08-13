import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, autorun, runInAction } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

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
    overflow-y: auto;
    position: relative;

    box-sizing: border-box;
    height: 100%;
`;

const MockPageHeader = styled.header`
    position: sticky;
    top: 0;
    z-index: 1;

    box-sizing: border-box;
    width: 100%;
    padding: 20px 40px;
    background-color: ${p => p.theme.containerBackground};
    border-bottom: 1px solid rgba(0,0,0,0.12);
    box-sizing: border-box;

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
    padding: 0 40px 20px;
`;

@inject('interceptionStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    // Map from rule id -> collapsed (true/false)
    @observable
    collapsedRulesMap = _.fromPairs(
        this.props.interceptionStore.unsavedInterceptionRules.map((rule) =>
            [rule.id, true] as [string, boolean]
        )
    );

    componentDidMount() {
        // If the list of rules ever changes, update the collapsed list accordingly.
        // Drop now-unnecessary ids, and add new rules (defaulting to collapsed)
        disposeOnUnmount(this, autorun(() => {
            const rules = this.props.interceptionStore.unsavedInterceptionRules;
            const ruleIds = rules.map(r => r.id);
            const ruleMapIds = _.keys(this.collapsedRulesMap);

            const extraIds = _.difference(ruleMapIds, ruleIds);
            const missingIds = _.difference(ruleIds, ruleMapIds);

            runInAction(() => {
                extraIds.forEach((extraId) => {
                    delete this.collapsedRulesMap[extraId];
                });

                missingIds.forEach((missingId) => {
                    this.collapsedRulesMap[missingId] = true;
                });
            });
        }));
    }

    render(): JSX.Element {
        const {
            unsavedInterceptionRules,
            areSomeRulesUnsaved
        } = this.props.interceptionStore;

        return <MockPageContainer>
            <MockPageHeader>
                <MockHeading>Mock & Rewrite HTTP</MockHeading>
                <SaveButton disabled={!areSomeRulesUnsaved} onClick={this.saveAll}>
                    Save changes
                </SaveButton>
            </MockPageHeader>

            <MockRuleList>
                <AddRuleRow onAdd={this.addRule} />

                { unsavedInterceptionRules.map((rule, i) =>
                    <RuleRow
                        key={rule.id}
                        rule={rule}
                        collapsed={this.collapsedRulesMap[rule.id]}
                        toggleCollapse={() => this.toggleRuleCollapsed(rule.id)}
                        deleteRule={() => this.deleteRule(i)}
                    />
                ) }
            </MockRuleList>
        </MockPageContainer>
    }

    @action.bound
    saveAll() {
        this.props.interceptionStore.saveInterceptionRules();

        // Collapse everything
        Object.keys(this.collapsedRulesMap).forEach((ruleId) => {
            this.collapsedRulesMap[ruleId] = true;
        })
    }

    @action.bound
    addRule() {
        const rules = this.props.interceptionStore.unsavedInterceptionRules;
        const newRule = getNewRule();
        // When you explicitly add a new rule, start it off expanded.
        this.collapsedRulesMap[newRule.id] = false;
        rules.unshift(newRule);
    }

    @action.bound
    deleteRule(ruleIndex: number) {
        const rules = this.props.interceptionStore.unsavedInterceptionRules;
        rules.splice(ruleIndex, 1);
    }

    @action.bound
    toggleRuleCollapsed(ruleId: string) {
        this.collapsedRulesMap[ruleId] = !this.collapsedRulesMap[ruleId];
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedMockPage = MockPage as unknown as WithInjected<
    typeof MockPage,
    'interceptionStore'
>;
export { InjectedMockPage as MockPage };