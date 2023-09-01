import * as React from 'react';

import { IconButton } from './icon-button';
import { ExpandState } from './card';

export const ExpandShrinkButton = (p: {
    expanded: ExpandState | undefined,
    onClick: () => void
}) =>
    <IconButton
        icon={[
            'fas',
            p.expanded ? 'compress-arrows-alt' : 'expand'
        ]}
        onClick={p.onClick}
        title={
            p.expanded
                ? "Shrink this area, so you can see other details"
                : "Expand this area to view it in more detail, hiding other areas"
        }
    />