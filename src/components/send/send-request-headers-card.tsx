import * as React from 'react';
import { observer } from 'mobx-react';

import { RawHeaders } from '../../types';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import { EditableRawHeaders } from '../common/editable-headers';

export interface SendRequestHeadersProps extends CollapsibleCardProps {
    headers: RawHeaders;
    updateHeaders: (headers: RawHeaders) => void;
}

export const SendRequestHeadersCard = observer((props: SendRequestHeadersProps) => {
    return <CollapsibleCard {...props}>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Headers
            </CollapsibleCardHeading>
        </header>
        <EditableRawHeaders
            headers={props.headers}
            onChange={props.updateHeaders}
        />
    </CollapsibleCard>;
});