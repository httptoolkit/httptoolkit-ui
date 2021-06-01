import * as _ from 'lodash';
import * as React from 'react';
import { action } from 'mobx';
import { observer } from 'mobx-react';

import { Headers } from '../../types';
import { styled } from '../../styles';
import { HEADER_NAME_PATTERN } from '../../model/http/http-docs';

import { clickOnEnter } from '../component-utils';
import { Button, TextInput } from './inputs';
import { Icon } from '../../icons';

export type HeadersArray = Array<[string, string]>;

export const headersToHeadersArray = (headers: Headers): HeadersArray =>
    Object.entries(headers || {}).reduce(
        (acc: Array<[string, string]>, [key, value]) => {
            if (_.isArray(value)) {
                acc = acc.concat(value.map(v => [key, v]))
            } else {
                acc.push([key, value || '']);
            }
            return acc;
        }, []
    );

export const headersArrayToHeaders = (headers: HeadersArray): Headers =>
    headers.reduce((headersObj: { [k: string]: string | string[] }, [key, value]) => {
        const headerName = key.toLowerCase();

        const existingValue = headersObj[headerName];
        if (existingValue === undefined) {
            headersObj[headerName] = value;
        } else if (_.isString(existingValue)) {
            headersObj[headerName] = [existingValue, value];
        } else {
            existingValue.push(value);
        }
        return headersObj;
    }, {});

interface EditableHeadersProps {
    headers: HeadersArray;
    onChange: (headers: HeadersArray) => void;

    // It's unclear whether you're strictly allowed completely empty header values, but it's definitely
    // not recommended and poorly supported. By default we disable it except for special use cases.
    allowEmptyValues?: boolean;
}

const HeadersContainer = styled.div`
    display: grid;
    grid-gap: 5px;
    grid-template-columns: 1fr 2fr min-content;

    > :last-child {
        grid-column: 2 / span 2;
    }
`;


const HeaderDeleteButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 3px 10px 5px;
`;

export const EditableHeaders = observer((props: EditableHeadersProps) => {
    const { headers, onChange, allowEmptyValues } = props;

    return <HeadersContainer>
        { _.flatMap(headers, ([key, value], i) => [
            <TextInput
                value={key}
                required
                pattern={HEADER_NAME_PATTERN}
                title={"Header names must contain only alphanumeric characters and !#$%&'*+-.^_`|~ symbols"}
                disabled={key.startsWith(':')}
                spellCheck={false}
                key={`${i}-key`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    event.target.reportValidity();

                    let headerKey = event.target.value;

                    // Drop leading :'s when editing, since they're not allowed
                    while (headerKey.startsWith(':')) headerKey = headerKey.slice(1);

                    headers[i][0] = headerKey;
                    onChange(headers);
                })}
            />,
            <TextInput
                value={value}
                required={!allowEmptyValues}
                disabled={key.startsWith(':')}
                spellCheck={false}
                key={`${i}-val`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    event.target.reportValidity();
                    headers[i][1] = event.target.value;
                    onChange(headers);
                })}
            />,
            <HeaderDeleteButton
                key={`${i}-del`}
                disabled={key.startsWith(':')}
                onClick={action(() => {
                    headers.splice(i, 1);
                    onChange(headers);
                })}
                onKeyPress={clickOnEnter}
            >
                <Icon icon={['far', 'trash-alt']} />
            </HeaderDeleteButton>
        ]).concat([
            <TextInput
                value=''
                pattern={HEADER_NAME_PATTERN}
                placeholder='Header name'
                spellCheck={false}
                key={`${headers.length}-key`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    let headerKey = event.target.value;

                    while (headerKey.startsWith(':')) headerKey = headerKey.slice(1);

                    if (headerKey) headers.push([headerKey, '']);
                    onChange(headers);
                })}
            />,
            <TextInput
                value=''
                placeholder='Header value'
                spellCheck={false}
                key={`${headers.length}-val`}
                onChange={action((event: React.ChangeEvent<HTMLInputElement>) => {
                    headers.push(['', event.target.value]);
                    onChange(headers);
                })}
            />
        ]) }
    </HeadersContainer>
});