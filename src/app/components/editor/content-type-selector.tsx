import * as React from 'react';

import { Pill } from '../common/pill';

const contentTypes = [
    'text/plain',
    'application/json'
];

/*
Pill style drop down
Takes a content type header
Includes the list of relevant content types you want want to view

Editor controller has a list
*/

export const ContentTypeSelector = (props: {
    contentType: string,
    onChange: (contentType: string) => void
}) => <select
    onChange={(e) => props.onChange(e.target.value)}
    value={props.contentType}
>
    {contentTypes.map((contentType) =>
        <option key={ contentType } value={ contentType }>
            { contentType }
        </option>
    )}
</select>;