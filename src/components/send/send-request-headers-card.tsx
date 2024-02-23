import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { RawHeaders } from '../../types';

import {
    CollapsibleCardHeading,
    ExpandableCardProps
} from '../common/card';
import {
    SendCardSection,
    SendCardScrollableWrapper
} from './send-card-section';
import { EditableRawHeaders } from '../common/editable-headers';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { CollapsingButtons } from '../common/collapsing-buttons';

export interface SendRequestHeadersProps extends ExpandableCardProps {
    headers: RawHeaders;
    updateHeaders: (headers: RawHeaders) => void;
}

export const SendRequestHeadersCard = observer(({
    headers,
    updateHeaders,
    ...cardProps
}: SendRequestHeadersProps) => {
    return <SendCardSection
        {...cardProps}
        headerAlignment='left'
    >
        <header>
            <CollapsingButtons>
                <ExpandShrinkButton
                    expanded={cardProps.expanded}
                    onClick={cardProps.onExpandToggled}
                />
            </CollapsingButtons>
            <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                Request Headers
            </CollapsibleCardHeading>
        </header>
        <SendCardScrollableWrapper>
            <EditableRawHeaders
                headers={headers}
                onChange={updateHeaders}
            />
        </SendCardScrollableWrapper>
    </SendCardSection>;
});