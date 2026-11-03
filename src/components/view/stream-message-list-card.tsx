import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { ViewableEvent } from '../../types';
import { saveFile } from '../../util/ui';

import { StreamMessage } from '../../model/events/stream-message';
import { exportEventsAsHar } from '../../model/ui/export';
import { getSummaryColor } from '../../model/events/categorization';

import { Pill } from '../common/pill';
import { IconButton } from '../common/icon-button';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { CollapsibleCard, CollapsibleCardHeading, ExpandableCardProps } from '../common/card';

import { SelfSizedEditor } from '../editor/base-editor';
import {
    StreamMessageCollapsedRow,
    StreamMessageEditorRow
} from './stream-message-rows';

function getMessageFilename(
    filenamePrefix: string,
    isBinary: boolean,
    messageIndex: number
) {
    return `${filenamePrefix} message ${messageIndex}.${isBinary ? 'bin' : 'txt'}`;
}

@observer
export class StreamMessageListCard extends React.Component<ExpandableCardProps & {
    isPaidUser: boolean,
    filenamePrefix: string,
    // The event containing these messages, for the HAR export
    streamEvent: ViewableEvent,
    streamId: string,
    cardHeading: string,
    streamLabel?: string,
    messages: ReadonlyArray<StreamMessage>,
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor>
    onClearMessages?: () => void,
}> {

    @observable
    expandedRow: number | undefined = undefined;

    render() {
        const {
            streamId,
            cardHeading,
            streamLabel,
            messages,
            isPaidUser,
            editorNode,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled,
            onClearMessages,
            ariaLabel
        } = this.props;

        return <CollapsibleCard
            collapsed={collapsed}
            onCollapseToggled={onCollapseToggled}
            expanded={expanded}
            ariaLabel={ariaLabel}
        >
            <header>
                <CollapsingButtons>
                    { onExpandToggled && <ExpandShrinkButton
                        expanded={expanded}
                        onClick={onExpandToggled}
                    /> }
                    <IconButton
                        icon={['fas', 'download']}
                        title={
                            isPaidUser
                                ? "Save these messages as a HAR file"
                                : "With Pro: Save these messages as a HAR file"
                        }
                        disabled={!isPaidUser}
                        onClick={this.exportMessages}
                    />
                    { onClearMessages &&
                        <IconButton
                            icon={['far', 'trash-alt']}
                            title="Clear all messages"
                            onClick={onClearMessages}
                        /> }
                </CollapsingButtons>
                { streamLabel && <Pill
                    color={getSummaryColor('data')}
                    title={streamLabel}
                >
                    { streamLabel }
                </Pill> }
                <Pill>
                    { messages.length } message{
                        messages.length !== 1 ? 's' : ''
                    }
                </Pill>
                <CollapsibleCardHeading
                    onCollapseToggled={onCollapseToggled}
                >
                    { cardHeading }
                </CollapsibleCardHeading>
            </header>
            <StreamMessagesList expanded={!!expanded}>
                {
                    messages.map((message, i) =>
                        this.expandedRow === i
                        ? <StreamMessageEditorRow
                            key='expanded' // Constant, which preserves content type between rows
                            message={message}

                            streamId={streamId}
                            isPaidUser={isPaidUser}
                            onExportMessage={this.exportMessage}
                            editorNode={editorNode}
                        />
                        : <StreamMessageCollapsedRow
                            key={i}
                            message={message}

                            index={i}
                            onClick={this.expandRow}
                        />
                    )
                }
            </StreamMessagesList>
        </CollapsibleCard>;
    }

    @action.bound
    expandRow(index: number) {
        this.expandedRow = index;
    }

    exportMessages = () => {
        exportEventsAsHar([this.props.streamEvent], `${this.props.filenamePrefix}.har`);
    };

    exportMessage = (message: StreamMessage) => {
        const filename = getMessageFilename(
            this.props.filenamePrefix,
            message.isBinary,
            this.props.messages.indexOf(message)
        );

        saveFile(
            filename,
            message.isBinary
                ? 'application/octet-stream'
                : 'text/plain',
            message.content
        );
    }

}

const StreamMessagesList = styled.div<{ expanded: boolean }>`
    width: calc(100% + 40px);
    margin: 0 -20px -20px -20px;

    border-top: solid 1px ${p => p.theme.containerWatermark};
    background-color: ${p => p.theme.mainLowlightBackground};

    display: flex;
    flex-direction: column;
    white-space: nowrap;

    position: relative;
    ${p => p.expanded && `
        height: auto !important;
        overflow-y: auto;
    `}
`;
