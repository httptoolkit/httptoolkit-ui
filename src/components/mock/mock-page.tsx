import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, autorun, runInAction } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';
import {
    SortableContainer,
    SortableElement,
    SortableHandle,
  } from 'react-sortable-hoc';

import { styled } from '../../styles';
import { WithInjected } from '../../types';

import { ActivatedStore } from '../../model/interception-store';
import { getNewRule, HtkMockRule } from '../../model/rules/rules';

import { Button } from '../common/inputs';
import { AddRuleRow, SortableRuleRow } from './rule-row';

interface MockPageProps {
    className?: string,
    interceptionStore: ActivatedStore,
}

const MockPageContainer = styled.section`
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    display: flex;
    flex-flow: column;
    align-items: stretch;
`;

const MockPageScrollContainer = styled.div`
    overflow-y: scroll;
    flex-grow: 1;
`;

const MockPageHeader = styled.header`
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

const SortableMockRuleList = SortableContainer(observer(({ items, ...props }: {
    items: HtkMockRule[],
    addRule: () => void,
    collapsedRulesMap: { [id: string]: boolean },
    toggleRuleCollapsed: (id: string) => void,
    deleteRule: (index: number) => void,
    currentlyDraggingRuleIndex: number | undefined
}) =>
    <MockRuleList>
        <AddRuleRow
            onAdd={props.addRule}
            disabled={props.currentlyDraggingRuleIndex !== undefined}
        />

        { items.map((item, i) => {
            const isCollapsed = props.collapsedRulesMap[item.id];
            return <SortableRuleRow
                key={item.id}
                index={i}
                value={item}

                collapsed={isCollapsed}
                disabled={!isCollapsed}
                rowDisabled={
                    // When dragging, disable all rules
                    props.currentlyDraggingRuleIndex !== undefined &&
                    props.currentlyDraggingRuleIndex !== i
                }

                toggleCollapse={() => props.toggleRuleCollapsed(item.id)}
                deleteRule={() => props.deleteRule(i)}
            />
        }) }
    </MockRuleList>
));

@inject('interceptionStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    containerRef = React.createRef<HTMLDivElement>();

    // Map from rule id -> collapsed (true/false)
    @observable
    collapsedRulesMap = _.fromPairs(
        this.props.interceptionStore.unsavedInterceptionRules.map((rule) =>
            [rule.id, true] as [string, boolean]
        )
    );

    @observable
    currentlyDraggingRuleIndex: number | undefined;

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
        const { currentlyDraggingRuleIndex } = this;

        return <MockPageContainer ref={this.containerRef}>
            <MockPageHeader>
                <MockHeading>Mock & Rewrite HTTP</MockHeading>
                <SaveButton disabled={!areSomeRulesUnsaved} onClick={this.saveAll}>
                    Save changes
                </SaveButton>
            </MockPageHeader>

            <MockPageScrollContainer>
                <SortableMockRuleList
                    items={unsavedInterceptionRules}
                    collapsedRulesMap={this.collapsedRulesMap}
                    addRule={this.addRule}
                    toggleRuleCollapsed={this.toggleRuleCollapsed}
                    deleteRule={this.deleteRule}
                    currentlyDraggingRuleIndex={currentlyDraggingRuleIndex}

                    useDragHandle
                    lockAxis={'y'}
                    onSortStart={this.startMovingRule}
                    onSortEnd={this.moveRule}
                    transitionDuration={100}
                />
            </MockPageScrollContainer>
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

        // Wait briefly for the new rule to appear, then focus its first dropdown
        setTimeout(() => {
            const container = this.containerRef.current;
            if (!container) return;

            const dropdown = container.querySelector(
                'ol > section:nth-child(2) select'
            ) as HTMLSelectElement | undefined;
            if (dropdown) dropdown.focus();
            // If there's a race, this will just do nothing
        }, 100);
    }

    @action.bound
    deleteRule(ruleIndex: number) {
        const rules = this.props.interceptionStore.unsavedInterceptionRules;
        rules.splice(ruleIndex, 1);
    }

    @action.bound
    startMovingRule({ index }: { index: number }) {
        this.currentlyDraggingRuleIndex = index;
    }

    @action.bound
    moveRule({ oldIndex, newIndex }: { oldIndex: number, newIndex: number }) {
        const rules = this.props.interceptionStore.unsavedInterceptionRules;
        const rule = rules[oldIndex];
        rules.splice(oldIndex, 1);
        rules.splice(newIndex, 0, rule);
        this.currentlyDraggingRuleIndex = undefined;
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