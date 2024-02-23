import * as React from 'react';

import { RawHeaders } from '../../types';
import {IncludeExcludeList} from '../../model/IncludeExcludeList';


import {
    CollapsibleCardHeading,
    ExpandableCardProps
} from '../common/card';

import { HeaderDetails } from '../view/http/header-details';
import { SendCardSection } from './send-card-section';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { ExpandShrinkButton } from '../common/expand-shrink-button';

export interface ResponseHeaderSectionProps extends ExpandableCardProps {
    requestUrl: URL;
    headers: RawHeaders;
}
const HeadersIncludeExcludeList = new IncludeExcludeList<string>();

export const SentResponseHeaderSection = ({
    requestUrl,
    headers,
    ...cardProps
}: ResponseHeaderSectionProps) => {
    return <SendCardSection {...cardProps}>
        <header>
            <CollapsingButtons>
                <ExpandShrinkButton
                    expanded={cardProps.expanded}
                    onClick={cardProps.onExpandToggled}
                />
            </CollapsingButtons>
            <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                Response Headers
            </CollapsibleCardHeading>
        </header>
        <HeaderDetails HeadersIncludeExcludeList={HeadersIncludeExcludeList}
            requestUrl={requestUrl}
            headers={headers}
        />
    </SendCardSection>;
};