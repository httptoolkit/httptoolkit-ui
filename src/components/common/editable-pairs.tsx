import * as _ from 'lodash';
import * as React from 'react';
import { action } from 'mobx';
import { observer } from 'mobx-react';

import { styled } from '../../styles';

import { clickOnEnter } from '../component-utils';
import { Button, TextInput } from './inputs';
import { Icon } from '../../icons';

export type Pair = { key: string, value: string, disabled?: boolean };
export type PairsArray = Array<Pair>;

interface EditablePairsProps {
    // Mutated directly by changes before onChange is called
    pairs: PairsArray;
    onChange: (pairs: PairsArray) => void;

    keyTitle?: string;
    keyPattern?: string;

    keyPlaceholder: string;
    valuePlaceholder: string;

    // Disabled by default, but can be useful in some cases
    allowEmptyValues?: boolean;
}

const PairsContainer = styled.div`
    display: grid;
    grid-gap: 5px;
    grid-template-columns: 1fr 2fr min-content;

    > :last-child {
        grid-column: 2 / span 2;
    }
`;

const PairDeleteButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 3px 10px 5px;
`;

export const EditablePairs = observer((props: EditablePairsProps) => {
    const {
        pairs,
        onChange,
        keyTitle,
        keyPattern,
        keyPlaceholder,
        valuePlaceholder,
        allowEmptyValues
    } = props;

    return <PairsContainer>
        { _.flatMap(pairs, ({ key, value, disabled }, i) => [
            <TextInput
                value={key}
                required
                pattern={keyPattern}
                title={keyTitle}
                disabled={disabled}
                spellCheck={false}
                key={`${i}-key`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    event.target.reportValidity();
                    pairs[i].key = event.target.value;
                    onChange(pairs);
                })}
            />,
            <TextInput
                value={value}
                required={!allowEmptyValues}
                disabled={disabled}
                spellCheck={false}
                key={`${i}-val`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    event.target.reportValidity();
                    pairs[i].value = event.target.value;
                    onChange(pairs);
                })}
            />,
            <PairDeleteButton
                key={`${i}-del`}
                disabled={disabled}
                onClick={action(() => {
                    pairs.splice(i, 1);
                    onChange(pairs);
                })}
                onKeyPress={clickOnEnter}
            >
                <Icon icon={['far', 'trash-alt']} />
            </PairDeleteButton>
        ]).concat([
            <TextInput
                value=''
                pattern={keyPattern}
                placeholder={keyPlaceholder}
                spellCheck={false}
                key={`${pairs.length}-key`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    let key = event.target.value;
                    if (key) pairs.push({ key: key, value: '' });
                    onChange(pairs);
                })}
            />,
            <TextInput
                value=''
                placeholder={valuePlaceholder}
                spellCheck={false}
                key={`${pairs.length}-val`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    let value = event.target.value;
                    if (value) pairs.push({ key: '', value: event.target.value });
                    onChange(pairs);
                })}
            />
        ]) }
    </PairsContainer>
});