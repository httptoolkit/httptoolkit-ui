import * as React from 'react';

import { RawHeaders } from '../../types';

import {
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';

import { HeaderDetails } from '../view/http/header-details';
import { SendCardSection } from './send-card-section';

export interface ResponseHeaderSectionProps extends CollapsibleCardProps {
    requestUrl: URL;
    headers: RawHeaders;
}

export const SentResponseHeaderSection = (props: ResponseHeaderSectionProps) => {
    return <SendCardSection {...props}>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Response Headers
            </CollapsibleCardHeading>
        </header>
        <HeaderDetails
            requestUrl={props.requestUrl}
            headers={props.headers}
        />
    </SendCardSection>;
};