import * as React from 'react';
import { observer } from 'mobx-react';

import { CollectedEvent } from '../../types';

import { EmptyState } from '../common/empty-state';

export const MultiSelectionSummaryPane = observer((props: {
    selectedEvents: ReadonlyArray<CollectedEvent>
}) => {
    const count = props.selectedEvents.length;

    return <EmptyState icon='ListChecks'>
        {count} event{count !== 1 ? 's' : ''} selected
    </EmptyState>;
});
