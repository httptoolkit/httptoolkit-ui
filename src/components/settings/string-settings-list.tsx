import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { Icon } from '../../icons';

import { InputValidationFunction } from '../component-utils';
import { TextInput } from '../common/inputs';
import { SettingsButton } from './settings-components';

const StringListContainer = styled.div`
    width: 100%;

    display: grid;
    grid-template-columns: auto min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    ${TextInput} {
        align-self: stretch;
    }
`;

export const ConfigValueRow = styled.div`
    min-width: 300px;
    font-family: ${p => p.theme.monoFontFamily};
`;

@observer
export class StringSettingsList extends React.Component<{
    values: string[],
    onDelete: (value: string) => void,
    onAdd: (value: string) => void,
    placeholder: string,
    validationFn: InputValidationFunction
}> {

    @observable
    inputValue = '';

    render() {
        const {
            values,
            onDelete,
            placeholder
        } = this.props;

        return <StringListContainer>
            { values.map((value) => [
                <ConfigValueRow key={`value-${value}`}>
                    { value }
                </ConfigValueRow>,
                <SettingsButton
                    key={`delete-${value}`}
                    onClick={() => onDelete(value)}
                >
                    <Icon icon={['far', 'trash-alt']} />
                </SettingsButton>
            ]) }

            <TextInput
                placeholder={placeholder}
                value={this.inputValue}
                onChange={this.changeInput}
            />
            <SettingsButton
                disabled={
                    !this.props.validationFn(this.inputValue) ||
                    values.includes(this.inputValue)
                }
                onClick={this.addHost}
            >
                <Icon icon={['fas', 'plus']} />
            </SettingsButton>
        </StringListContainer>;
    }

    @action.bound
    addHost(e: React.MouseEvent<HTMLButtonElement>) {
        this.props.onAdd(this.inputValue);
        this.inputValue = '';
    }

    @action.bound
    changeInput(e: React.ChangeEvent<HTMLInputElement>) {
        this.inputValue = e.target.value;
        this.props.validationFn(e.target);
    }
}