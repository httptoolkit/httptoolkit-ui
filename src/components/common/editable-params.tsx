import * as React from 'react';

import { ReadOnlyPairs } from './editable-pairs';

export const ReadOnlyParams = (props: { content: string, className?: string }) => {
    const params = new URLSearchParams(props.content);
    const paramPairs = [...params].map(([key, value]) => ({ key, value }));
    return <ReadOnlyPairs
        className={props.className}
        pairs={paramPairs}
    />;
}