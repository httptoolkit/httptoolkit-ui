import * as React from 'react';

import { Pill } from '../common/pill';
import { styled } from '../../styles';

const contentTypes = [
    'text/plain',
    'application/json'
];

const Selector = styled(Pill.withComponent('select'))`
    border: none;

    height: 24px;
    padding: 0 4px 3px 8px;

    font-size: 16px;
    font-family: Lato, Arial, sans-serif;
`;

export const ContentTypeSelector = (props: {
    contentType: string,
    onChange: (contentType: string) => void
}) => <Selector
    onChange={(e: any) =>
        props.onChange(e.target.value)
    }
    value={props.contentType}
>
    {contentTypes.map((contentType) =>
        <option key={ contentType } value={ contentType }>
            { contentType }
        </option>
    )}
</Selector>;