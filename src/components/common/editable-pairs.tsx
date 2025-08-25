import * as _ from 'lodash';
import * as React from 'react';
import { action, autorun, comparer, observable, reaction } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';

import { styled } from '../../styles';

import { Button, TextInput } from './inputs';
import { Icon } from '../../icons';

export type Pair = { key: string, value: string, disabled?: true };
export type PairsArray = Array<Pair>;

interface EditablePairsProps<R = PairsArray> {
    className?: string;

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
    // Either a pattern string, or a validation function
    keyValidation?: string | ((key: string) => true | string);
    valueValidation?: string | ((value: string) => true | string);

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

    private containerRef = React.createRef<HTMLDivElement>();

    @observable
    private values: PairsArray = _.cloneDeep(this.props.pairs);

    // Track the last value length. This is used to detect manually added new rows, and
    // manage the UX around that.
    private lastValuesLength = this.values.length;

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
                    this.lastValuesLength = this.values.length;
                }
            },
            { equals: comparer.structural }
        ));

        disposeOnUnmount(this, autorun(() => {
            let { keyValidation, valueValidation } = this.props;
            if (!_.isFunction(keyValidation) && !_.isFunction(valueValidation)) return;

            const inputs = this.containerRef?.current?.querySelectorAll('input');
            if (!inputs) return;

            this.values.forEach((pair, i) => {
                const keyInput = inputs?.[i * 2];
                const valueInput = inputs?.[i * 2 + 1];

                ([
                    [ keyInput, pair.key, keyValidation ],
                    [ valueInput, pair.value, valueValidation ]
                ] as const).forEach(([input, value, validation]) => {
                    if (!input || !_.isFunction(validation)) return;
                    const result = validation(value);
                    if (result === true) {
                        input.setCustomValidity('');
                    } else {
                        input.setCustomValidity(result);
                    }

                    input.reportValidity();
                });
            });
        }));
    }

    private convert = (pairs: PairsArray): R => {
        if (this.props.convertResult) {
            return this.props.convertResult(pairs);
        } else {
            return _.cloneDeep(pairs) as unknown as R;
        }
    };

    private onChangeValues = (pairs: PairsArray) => {
        const { props: { transformInput, onChange }, convert } = this;

        if (transformInput) {
            this.values = transformInput(pairs);
        } else {
            this.values = pairs;
        }

        // If we've just manually added a new row, make sure the parent scrolls
        // to show it (note we ignore this for external updates).
        const addedNewRow = this.values.length === this.lastValuesLength + 1;
        this.lastValuesLength = this.values.length;
        if (addedNewRow) {
            requestAnimationFrame(() => {
                const container = this.containerRef.current;
                const lastInput = container?.querySelector<HTMLElement>('input:last-child');
                lastInput?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            });
        }

        onChange(convert(this.values));
    };

    render() {
        const {
            className,
            keyTitle,
            keyValidation,
            keyPlaceholder,
            valuePlaceholder,
            allowEmptyValues
        } = this.props;

        const { values, onChangeValues, containerRef } = this;

        const keyPattern = typeof keyValidation === 'string'
            ? keyValidation
            : undefined;

        return <EditablePairsContainer
            className={className}
            ref={containerRef}
        >
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