import * as React from 'react';
import { observer, inject } from 'mobx-react';

import { HttpExchangeView } from '../../../types';
import { styled } from '../../../styles';

import { UiStore } from '../../../model/ui/ui-store';
import { getStatusColor } from '../../../model/events/categorization';

import { Pill } from '../../common/pill';
import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../../common/card';
import { ContentMonoValue } from '../../common/text-content';

const ErrorContent = styled(ContentMonoValue)`
    margin-top: 10px;
`;

export const HttpAbortedResponseCard = inject('uiStore')(observer((p: {
    cardProps: CollapsibleCardProps,
    exchange: HttpExchangeView,
    uiStore?: UiStore
}) =>
    <CollapsibleCard {...p.cardProps} direction='left'>
        <header>
            <Pill color={getStatusColor('aborted', p.uiStore!.theme)}>
                Aborted
            </Pill>
            <CollapsibleCardHeading onCollapseToggled={p.cardProps.onCollapseToggled}>
                Response
            </CollapsibleCardHeading>
        </header>
        <div>
            The connection failed before a response could be completed{
                p.exchange.abortMessage
                ? <> with error:
                        <ErrorContent>
                            { p.exchange.abortMessage }
                        </ErrorContent>
                </>
                : '.'
            }
        </div>
    </CollapsibleCard>
));