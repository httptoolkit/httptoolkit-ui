import * as React from 'react';
import { observer } from 'mobx-react';

import { Theme } from '../../styles';
import { InputWebSocketClose } from '../../types';

import { getWebSocketCloseColor } from '../../model/events/categorization';
import { getWebSocketCloseCodeDocs } from '../../model/http/http-docs';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import {
    CollapsibleSection,
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../common/collapsible-section';
import { Pill } from '../common/pill';
import {
    ContentLabel,
    ContentValue,
    BlankContentPlaceholder,
    Markdown
} from '../common/text-content';
import { DocsLink } from '../common/docs-link';

interface WebSocketCloseCardProps extends CollapsibleCardProps {
    theme: Theme;
    closeState: InputWebSocketClose | 'aborted';
}

export const WebSocketCloseCard = observer((props: WebSocketCloseCardProps) => {
    const { closeState, theme } = props;

    const closeCodeDocs = props.closeState !== 'aborted'
        ? getWebSocketCloseCodeDocs(props.closeState.closeCode)
        : undefined;

    const responseDetails = closeCodeDocs && [
        <Markdown
            key='code-docs'
            content={closeCodeDocs.summary}
        />,
        // We just link to the RFC every time for close codes, no better docs available really:
        <p key='docs-link'>
            <DocsLink href='https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1'>Find out more</DocsLink>
        </p>
    ];


    if (closeState === 'aborted') {
        return <CollapsibleCard {...props}>
            <header>
                <Pill color={getWebSocketCloseColor('aborted', theme)}>Aborted</Pill>
                <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                    Connection closed
                </CollapsibleCardHeading>
            </header>
            <div>
                The connection was closed abruptly, without a clean close message.
            </div>
        </CollapsibleCard>;
    } else {
        const { closeCode, closeReason } = closeState;

        return <CollapsibleCard {...props}>
            <header>
                <Pill color={getWebSocketCloseColor(closeCode, theme)}>{
                    closeCode ?? 'No close code'
                }</Pill>
                <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                    Connection closed
                </CollapsibleCardHeading>
            </header>

            <CollapsibleSection>
                <CollapsibleSectionSummary>
                    <ContentLabel>Close code: </ContentLabel>
                    { closeCode
                        ? <ContentValue>{ closeCode }</ContentValue>
                        : <BlankContentPlaceholder>(No close code)</BlankContentPlaceholder>
                    }
                </CollapsibleSectionSummary>

                { responseDetails &&
                    <CollapsibleSectionBody>
                        { responseDetails }
                    </CollapsibleSectionBody>
                }
            </CollapsibleSection>

            <div>
                <ContentLabel>Close reason: </ContentLabel>
                { closeReason
                    ? <ContentValue>{ closeReason }</ContentValue>
                    : <BlankContentPlaceholder>(No reason provided)</BlankContentPlaceholder>
                }
            </div>
        </CollapsibleCard>;
    }
});