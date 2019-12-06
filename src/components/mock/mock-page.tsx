import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, autorun, runInAction } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';
import * as dateFns from 'date-fns';

import { styled } from '../../styles';
import { WithInjected } from '../../types';
import { Icon } from '../../icons';

import { ActivatedStore } from '../../model/interception-store';
import { AccountStore } from '../../model/account/account-store';
import { getNewRule, flattenRules, findItemPath, ItemPath, mapRules } from '../../model/rules/rules';

import { clickOnEnter } from '../component-utils';
import { Button, SecondaryButton } from '../common/inputs';
import { MockRuleList } from './mock-rule-list';
import { uploadFile, saveFile } from '../../util';
import { serializeRules } from '../../model/rules/rule-serialization';

interface MockPageProps {
    className?: string;
    interceptionStore: ActivatedStore;
    accountStore: AccountStore;
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
    padding: 20px calc(40px + 16px) 20px 40px; /* ~16px to match scrollbar below */
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
    flex-grow: 1;
`;

const SaveButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    font-weight: bold;
    padding: 10px 24px;
    margin-left: 20px;

    svg {
        margin-right: 5px;
    }
`;
const OtherButton = styled(SecondaryButton)`
    border: none;
    font-size: 1.2em;
    padding: 5px 10px;
    margin-left: 10px;
`;

@inject('interceptionStore')
@inject('accountStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    containerRef = React.createRef<HTMLDivElement>();

    // Map from rule id -> collapsed (true/false)
    @observable
    collapsedRulesMap = _.fromPairs(
        mapRules(this.props.interceptionStore.draftRules, (rule) =>
            [rule.id, true] as [string, boolean]
        )
    );

    componentDidMount() {
        // If the list of rules ever changes, update the collapsed list accordingly.
        // Drop now-unnecessary ids, and add new rules (defaulting to collapsed)
        disposeOnUnmount(this, autorun(() => {
            const ruleIds = mapRules(this.props.interceptionStore.draftRules, r => r.id);
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
            rules,
            draftRules,
            areSomeRulesUnsaved,
            areSomeRulesNonDefault
        } = this.props.interceptionStore;
        const { isPaidUser } = this.props.accountStore;

        return <MockPageContainer ref={this.containerRef}>
            <MockPageHeader>
                <MockHeading>Mock & Rewrite HTTP</MockHeading>

                <OtherButton
                    disabled={!areSomeRulesNonDefault}
                    onClick={this.resetToDefaults}
                    onKeyPress={clickOnEnter}
                    title="Reset rules to default"
                >
                    <Icon icon={['far', 'trash-alt']} />
                </OtherButton>
                <OtherButton
                    disabled={!isPaidUser}
                    onClick={this.importRules}
                    onKeyPress={clickOnEnter}
                    title={
                        isPaidUser
                            ? 'Import a saved set of rules'
                            : (
                                'With Pro: Import a set of saved rules, so you can build your ' +
                                'own ready-to-use collections of predefined rules'
                            )
                    }
                >
                    <Icon icon={['fas', 'upload']} />
                </OtherButton>
                <OtherButton
                    disabled={!isPaidUser || !areSomeRulesNonDefault || draftRules.items.length === 0}
                    onClick={this.exportRules}
                    onKeyPress={clickOnEnter}
                    title={
                        isPaidUser
                            ? 'Export these rules'
                            : 'With Pro: Export these rules, to save them for quick reuse later'
                    }
                >
                    <Icon icon={['fas', 'download']} />
                </OtherButton>
                <OtherButton
                    disabled={!areSomeRulesUnsaved}
                    onClick={this.resetRuleDrafts}
                    onKeyPress={clickOnEnter}
                    title="Revert changes since the last save"
                >
                    <Icon icon={['fas', 'undo']} />
                </OtherButton>
                <SaveButton
                    disabled={!areSomeRulesUnsaved}
                    onClick={this.saveAll}
                    onKeyPress={clickOnEnter}
                    title="Save all rule changes"
                >
                    <Icon icon={['fas', 'save']} /> Save changes
                </SaveButton>
            </MockPageHeader>

            <MockPageScrollContainer>
                <MockRuleList
                    activeRules={rules}
                    draftRules={draftRules}
                    collapsedRulesMap={this.collapsedRulesMap}
                    addRule={this.addRule}

                    toggleRuleCollapsed={this.toggleRuleCollapsed}

                    saveRule={this.saveRule}
                    resetRule={this.resetRule}
                    deleteRule={this.deleteRule}
                    moveRule={this.moveRule}
                />
            </MockPageScrollContainer>
        </MockPageContainer>
    }

    @action.bound
    collapseAll() {
        Object.keys(this.collapsedRulesMap).forEach((ruleId) => {
            this.collapsedRulesMap[ruleId] = true;
        });
    }

    @action.bound
    saveRule(path: ItemPath) {
        const savedRule = this.props.interceptionStore.saveRule(path);
        this.collapsedRulesMap[savedRule.id] = true;
    }

    @action.bound
    resetRule(path: ItemPath) {
        this.props.interceptionStore.resetRule(path);
    }

    @action.bound
    saveAll() {
        this.props.interceptionStore.saveRules();
        this.collapseAll();
    }

    @action.bound
    resetToDefaults() {
        this.props.interceptionStore.resetRulesToDefault();
        this.collapseAll();
    }

    @action.bound
    resetRuleDrafts() {
        this.props.interceptionStore.resetRuleDrafts();
        this.collapseAll();
    }

    @action.bound
    addRule() {
        const rules = this.props.interceptionStore.draftRules;
        const newRule = getNewRule(this.props.interceptionStore);
        // When you explicitly add a new rule, start it off expanded.
        this.collapsedRulesMap[newRule.id] = false;
        rules.items.unshift(newRule);

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
    toggleRuleCollapsed(ruleId: string) {
        this.collapsedRulesMap[ruleId] = !this.collapsedRulesMap[ruleId];
    }

    @action.bound
    deleteRule(path: ItemPath) {
        this.props.interceptionStore.deleteDraftRule(path);
    }

    @action.bound
    moveRule(currentPath: ItemPath, targetPath: ItemPath) {
        this.props.interceptionStore.moveDraftRule(currentPath, targetPath);
    }

    readonly importRules = async () => {
        const uploadedFile = await uploadFile('text', [
            '.htkrules',
            'application/json',
            'application/htkrules+json'
        ]);
        if (uploadedFile) {
            this.props.interceptionStore.loadSavedRules(
                JSON.parse(uploadedFile)
            );
        }
    }

    readonly exportRules = async () => {
        const rulesetContent = JSON.stringify(
            serializeRules(this.props.interceptionStore.draftRules)
        );

        const filename = `HTTPToolkit_${
            dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
        }.htkrules`;

        saveFile(filename, 'application/htkrules+json;charset=utf-8', rulesetContent);
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedMockPage = MockPage as unknown as WithInjected<
    typeof MockPage,
    'interceptionStore' | 'accountStore'
>;
export { InjectedMockPage as MockPage };