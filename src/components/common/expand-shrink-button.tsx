import * as React from 'react';

import { IconButton } from './icon-button';

export const ExpandShrinkButton = (p: { expanded: boolean, onClick: () => void }) =>
    <IconButton
        icon={[
            'fas',
            p.expanded ? 'compress-arrows-alt' : 'expand'
        ]}
        onClick={p.onClick}
        title={
            p.expanded
                ? "Shrink this card, so you can see other details"
                : "Expand this card to view it in more detail, hiding other details"
        }
    />