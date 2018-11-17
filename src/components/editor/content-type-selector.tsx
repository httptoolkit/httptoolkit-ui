import * as _ from 'lodash';
import * as React from 'react';

import { HtkContentType, getCompatibleTypes, getContentTypeName } from '../../content-types';

import { styled } from '../../styles';
import { Pill } from '../common/pill';

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
    baseContentType: HtkContentType,
    selectedContentType: HtkContentType,
    onChange: (contentType: HtkContentType) => void
}) => {
    const compatibleTypes = getCompatibleTypes(props.baseContentType);

    if (!_.includes(compatibleTypes, props.selectedContentType)) {
        props.onChange(compatibleTypes[0]);
    }

    return <Selector
        onChange={(e: any) => props.onChange(e.target.value)}
        value={props.selectedContentType}
    >
        {compatibleTypes.map((contentType) =>
            <option key={ contentType } value={ contentType }>
                { getContentTypeName(contentType) }
            </option>
        )}
    </Selector>;
}