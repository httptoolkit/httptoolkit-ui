import * as React from 'react';

import {
    RawHeaders,
    HttpVersion
} from '../../types';

import {
    CollapsibleCardHeading,
    ExpandableCardProps
} from '../common/card';

import { HeaderDetails } from '../view/http/header-details';
import {
    SendCardSection,
    SentLoadingCard,
    SendCardScrollableWrapper
} from './send-card-section';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { ExpandShrinkButton } from '../common/expand-shrink-button';

export interface ResponseHeaderSectionProps extends ExpandableCardProps {
    httpVersion: HttpVersion;
    requestUrl: URL;
    headers: RawHeaders;
}

export const SentResponseHeaderSection = ({
    httpVersion,
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
        <SendCardScrollableWrapper>
            <HeaderDetails
                httpVersion={httpVersion}
                requestUrl={requestUrl}
                headers={headers}
            />
        </SendCardScrollableWrapper>
    </SendCardSection>;
};

export const PendingResponseHeaderSection = ({
    ...cardProps
}: ExpandableCardProps) => {
    return <SentLoadingCard {...cardProps}>
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
    </SentLoadingCard>;
};