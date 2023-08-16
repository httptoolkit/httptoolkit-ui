import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { RawHeaders } from '../../types';

import {
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import {
    SendCardSection
} from './send-card-section';
import { EditableRawHeaders } from '../common/editable-headers';

export interface SendRequestHeadersProps extends CollapsibleCardProps {
    headers: RawHeaders;
    updateHeaders: (headers: RawHeaders) => void;
}

const HeaderFieldsContainer = styled.div`
    overflow-y: auto;

    flex-grow: 1;
    flex-shrink: 1;

    margin: 0 -20px -20px -20px;
    padding: 0 20px 20px 20px;
`;

export const SendRequestHeadersCard = observer((props: SendRequestHeadersProps) => {
    return <SendCardSection {...props} headerAlignment='left'>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Request Headers
            </CollapsibleCardHeading>
        </header>
        <HeaderFieldsContainer>
            <EditableRawHeaders
                headers={props.headers}
                onChange={props.updateHeaders}
            />
        </HeaderFieldsContainer>
    </SendCardSection>;
});