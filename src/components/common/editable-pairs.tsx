import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';

import { styled } from '../../styles';

import { clickOnEnter } from '../component-utils';
import { Button, TextInput } from './inputs';
import { Icon } from '../../icons';

export type Pair = { key: string, value: string, disabled?: true };
export type PairsArray = Array<Pair>;

interface EditablePairsProps<R = PairsArray> {
    pairs: PairsArray;

    onChange: (pairs: R) => void;

    // Optionally, transform values before they're passed to onChange. If not set,
    // R must be PairsArray. This is useful because it's also used to ignore irrelevant
    // updates, preserving information lost in conversion with 2-way binding, for example
    // ordering of the pairs. Without this, duplicate keys in EditableHeaders and similar
    // result in the pairs reordering themselves while you're typing.
    convertResult?: (pairs: PairsArray) => R;

    // While convertResult defines transformations that don't update the UI, this
    // callback defines transforms that do - e.g. lowercasing input as it's typed.
    transformInput?: (pairs: PairsArray) => PairsArray;

    keyTitle?: string;
    keyPattern?: string;

    keyPlaceholder: string;
    valuePlaceholder: string;

    // Disabled by default, but can be useful in some cases
    allowEmptyValues?: boolean;
}

const ReadOnlyPairsContainer = styled.div`
    display: grid;
    grid-gap: 5px;
    grid-template-columns: 1fr 2fr;
`;

const EditablePairsContainer = styled(ReadOnlyPairsContainer)`
    grid-template-columns: 1fr 2fr min-content;

    > :last-child {
        grid-column: 2 / span 2;
    }
`;

const PairDeleteButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 3px 10px 5px;
`;

@observer
export class ReadOnlyPairs extends React.Component<{
    className?: string,
    pairs: PairsArray
}> {

    render() {
        const { pairs, className } = this.props;

        return <ReadOnlyPairsContainer className={className}>
            { _.flatMap(pairs, ({ key, value }, i) => [
                <TextInput
                    value={key}
                    readOnly={true}
                    spellCheck={false}
                    key={`${i}-key`}
                />,
                <TextInput
                    value={value}
                    readOnly={true}
                    spellCheck={false}
                    key={`${i}-val`}
                />
            ]) }
        </ReadOnlyPairsContainer>
    }
}

@observer
export class EditablePairs<R> extends React.Component<EditablePairsProps<R>> {

    @observable
    private values: PairsArray = _.cloneDeep(this.props.pairs);

    componentDidMount() {
        disposeOnUnmount(this, reaction(
            () => this.props.pairs,
            (pairs) => {
                if (!_.isEqual(this.convert(pairs), this.convert(this.values))) {
                    // Only updates values if some data changes other than their order.
                    // We treat order as a UI concern only for these pairs, and
                    // this avoids reordering due to conversion elsewhere, e.g. when entering
                    // duplicate header keys in EditableHeaders.
                    this.values = _.cloneDeep(pairs);
                }
            }
        ));
    }

    private convert = (pairs: PairsArray): R => {
        if (this.props.convertResult) {
            return this.props.convertResult(pairs);
        } else {
            return pairs as unknown as R;
        }
    };

    private onChangeValues = (pairs: PairsArray) => {
        const { props: { transformInput, onChange }, convert } = this;

        if (transformInput) {
            this.values = transformInput(pairs);
        } else {
            this.values = pairs;
        }

        onChange(convert(this.values));
    };

    render() {
        const {
            keyTitle,
            keyPattern,
            keyPlaceholder,
            valuePlaceholder,
            allowEmptyValues
        } = this.props;

        const { values, onChangeValues } = this;

        return <EditablePairsContainer>
            { _.flatMap(values, ({ key, value, disabled }, i) => [
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
                        values[i].key = event.target.value;
                        onChangeValues(values);
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
                        values[i].value = event.target.value;
                        onChangeValues(values);
                    })}
                />,
                <PairDeleteButton
                    key={`${i}-del`}
                    disabled={disabled}
                    onClick={action(() => {
                        values.splice(i, 1);
                        onChangeValues(values);
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
                    key={`${values.length}-key`}
                    onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                        let key = event.target.value;
                        if (key) values.push({ key: key, value: '' });
                        onChangeValues(values);
                    })}
                />,
                <TextInput
                    value=''
                    placeholder={valuePlaceholder}
                    spellCheck={false}
                    key={`${values.length}-val`}
                    onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                        let value = event.target.value;
                        if (value) values.push({ key: '', value: event.target.value });
                        onChangeValues(values);
                    })}
                />
            ]) }
        </EditablePairsContainer>
    }
}