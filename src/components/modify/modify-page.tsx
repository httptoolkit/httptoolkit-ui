import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, autorun, runInAction } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';
import * as dateFns from 'date-fns';

import { styled } from '../../styles';
import { WithInjected } from '../../types';
import { Icon } from '../../icons';
import { logError } from '../../errors';
import { uploadFile, saveFile } from '../../util/ui';

import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';

import { RuleType } from '../../model/rules/rules';
import { getNewRule, getRuleDefaultStep } from '../../model/rules/rule-creation';
import {
    cloneItem,
    getItemAtPath,
    isRuleGroup,
    ItemPath,
    mapRules
} from '../../model/rules/rules-structure';
import { SERIALIZED_RULES_MIME_TYPE, serializeRules } from '../../model/rules/rule-serialization';

import { clickOnEnter } from '../component-utils';
import { Button, SecondaryButton } from '../common/inputs';
import { RuleList } from './rule-list';

interface ModifyPageProps {
    className?: string;
    rulesStore: RulesStore;
    accountStore: AccountStore;

    navigate: (path: string) => void;
    initialRuleId?: string;
}

const ModifyPageContainer = styled.section`
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    display: flex;
    flex-flow: column;
    align-items: stretch;
`;

const ModifyPageScrollContainer = styled.div`
    overflow-y: scroll;
    flex-grow: 1;
`;

const ModifyPageHeader = styled.header`
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

const EditHeading = styled.h1`
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

@inject('rulesStore')
@inject('accountStore')
@observer
class ModifyPage extends React.Component<ModifyPageProps> {

    containerRef = React.createRef<HTMLDivElement>();

    // Map from rule id -> collapsed (true/false)
    @observable
    collapsedRulesMap = _.fromPairs(
        mapRules(this.props.rulesStore.draftRules, (rule) =>
            [
                rule.id,
                rule.id !== this.props.initialRuleId // We might start with a rule expanded
            ] as [string, boolean]
        )
    );

    componentDidMount() {
        // If the list of rules ever changes, update the collapsed list accordingly.
        // Drop now-unnecessary ids, and add new rules (defaulting to collapsed)
        disposeOnUnmount(this, autorun(() => {
            const ruleIds = mapRules(this.props.rulesStore.draftRules, r => r.id);
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

        // If a rule was initially selected, scroll to it.
        const { initialRuleId } = this.props;
        const container = this.containerRef.current;
        if (initialRuleId && container) {
            const ruleElement = container.querySelector(
                `[data-rbd-draggable-id="${initialRuleId}"]`
            );

            // Leave a little time for e.g. Monaco to render, then hop to it.
            requestAnimationFrame(() => ruleElement?.scrollIntoView());
        }
    }

    render(): JSX.Element {
        const {
            rules,
            draftRules,
            areSomeRulesUnsaved,
            areSomeRulesNonDefault,
            deleteDraftItem,
            moveDraftRule,
            updateGroupTitle,
            combineDraftRulesAsGroup
        } = this.props.rulesStore;
        const { isPaidUser } = this.props.accountStore;

        return <ModifyPageContainer ref={this.containerRef}>
            <ModifyPageHeader>
                <EditHeading>Transform & Mock HTTP</EditHeading>

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
                    <Icon icon={['fas', 'folder-open']} />
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
            </ModifyPageHeader>

            <ModifyPageScrollContainer>
                <RuleList
                    activeRules={rules}
                    draftRules={draftRules}
                    collapsedRulesMap={this.collapsedRulesMap}

                    addRule={this.addRule}
                    saveRule={this.saveRule}
                    resetRule={this.resetRule}
                    cloneItem={this.cloneItem}
                    deleteItem={deleteDraftItem}
                    toggleRuleCollapsed={this.toggleRuleCollapsed}
                    updateGroupTitle={updateGroupTitle}
                    getRuleDefaultStep={this.getRuleDefaultStep}

                    moveRule={moveDraftRule}
                    combineRulesAsGroup={combineDraftRulesAsGroup}
                />
            </ModifyPageScrollContainer>
        </ModifyPageContainer>
    }

    @action.bound
    collapseAll() {
        Object.keys(this.collapsedRulesMap).forEach((ruleId) => {
            this.collapsedRulesMap[ruleId] = true;
        });
    }

    @action.bound
    saveRule(path: ItemPath) {
        const savedRule = this.props.rulesStore.saveItem(path);
        this.collapsedRulesMap[savedRule.id] = true;
    }

    @action.bound
    resetRule(path: ItemPath) {
        this.props.rulesStore.resetRule(path);
    }

    @action.bound
    cloneItem(path: ItemPath) {
        const rules = this.props.rulesStore.draftRules;

        const clonedItem = cloneItem(getItemAtPath(rules, path));

        if (isRuleGroup(clonedItem)) {
            clonedItem.collapsed = true;
        } else {
            this.collapsedRulesMap[clonedItem.id] = true;
        }

        const existingChildIndex = _.last(path)!;

        this.props.rulesStore.addDraftItem(
            clonedItem,
            // Place the cloned rule directly after the existing rule
            [...path.slice(0, -1), existingChildIndex + 1]
        );
    }

    @action.bound
    saveAll() {
        this.props.rulesStore.saveRules();
        this.collapseAll();
    }

    @action.bound
    resetToDefaults() {
        const confirmResult = confirm("Reset all rules?");
        if (!confirmResult) return;

        this.props.rulesStore.resetRulesToDefault();
        this.collapseAll();
    }

    @action.bound
    resetRuleDrafts() {
        this.props.rulesStore.resetRuleDrafts();
        this.collapseAll();
    }

    @action.bound
    addRule() {
        const newRule = getNewRule(this.props.rulesStore);
        // When you explicitly add a new rule, start it off expanded.
        this.collapsedRulesMap[newRule.id] = false;
        this.props.rulesStore.addDraftItem(newRule);

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

    getRuleDefaultStep = (type: RuleType) => {
        return getRuleDefaultStep(type, this.props.rulesStore);
    };

    readonly importRules = async () => {
        const uploadedFile = await uploadFile('text', [
            '.htkrules',
            'application/json',
            'application/htkrules+json'
        ]);
        if (uploadedFile) {
            try {
                this.props.rulesStore.loadSavedRules(
                    JSON.parse(uploadedFile)
                );
            } catch (e) {
                logError(e);
                alert(`Rules could not be imported: ${e}`);
            }
        }
    }

    readonly exportRules = async () => {
        const rulesetContent = JSON.stringify(
            serializeRules(this.props.rulesStore.draftRules)
        );

        const filename = `HTTPToolkit_${
            dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
        }.htkrules`;

        saveFile(filename, SERIALIZED_RULES_MIME_TYPE, rulesetContent);
    }
}

// Exclude stores etc from the external props, as they're injected
const InjectedModifyPage = ModifyPage as unknown as WithInjected<
    typeof ModifyPage,
    'rulesStore' | 'accountStore' | 'navigate'
>;
export { InjectedModifyPage as ModifyPage };