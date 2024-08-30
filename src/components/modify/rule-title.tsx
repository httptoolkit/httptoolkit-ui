import * as React from 'react';

import { styled } from '../../styles';
import { noPropagation } from '../component-utils';

import { TextInput } from '../common/inputs';
import { IconMenuButton } from './rule-icon-menu';

export const RuleTitle = styled.h2`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    flex-basis: 100%;
    width: 100%;
    box-sizing: border-box;

    /* Required to avoid overflow trimming hanging chars */
    padding: 5px;
    margin: -5px;

    font-style: italic;
`;

const EditableTitleContainer = styled.div`
    flex-basis: 100%;
    margin: -4px;
`;

const TitleInput = styled(TextInput)`
    width: 30%;
    margin-right: 5px;
    margin-bottom: 10px;
`;

const TitleEditButton = styled(IconMenuButton)`
    font-size: 1em;
    padding: 0;
    vertical-align: middle;
`;

export const EditableRuleTitle = (p: {
    value: string,
    onEditTitle: (newValue: string) => void,
    onSave: (event: React.UIEvent) => void,
    onCancel?: () => void
}) => {
    const editTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        p.onEditTitle(e.target.value)
    };

    return <EditableTitleContainer>
        <TitleInput
            autoFocus
            value={p.value}
            placeholder='A custom name for this rule'
            onChange={editTitle}
            onClick={(e) => e.stopPropagation()}
            onKeyPress={(e) => {
                if (e.key === 'Enter') p.onSave(e);
            }}
        />
        <TitleEditButton
            title="Reset changes to rule name"
            icon={['fas', 'undo']}
            disabled={!p.onCancel}
            onClick={noPropagation(p.onCancel ?? (() => {}))}
        />
    </EditableTitleContainer>;
};