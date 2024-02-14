import * as _ from 'lodash';
import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { saveFile } from '../../util/ui';

import { StreamMessage } from '../../model/events/stream-message';
import { getSummaryColour } from '../../model/events/categorization';

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

function getFilename(
    filenamePrefix: string,
    someBinary: boolean,
    messageIndex?: number
) {
    const extension = someBinary ? 'bin' : 'txt';

    return `${filenamePrefix} ${
        messageIndex ? `message ${messageIndex}` : 'messages'
    }.${extension}`;
}

export type StreamType = 'WebSocket' | 'DataChannel';

@observer
export class StreamMessageListCard extends React.Component<ExpandableCardProps & {
    isPaidUser: boolean,
    filenamePrefix: string,
    streamId: string,
    streamType: StreamType,
    streamLabel?: string,
    messages: Array<StreamMessage>,
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor>
}> {

    @observable
    expandedRow: number | undefined = undefined;

    @computed
    get someBinaryMessages() {
        return this.props.messages.some(m => m.isBinary);
    }

    render() {
        const {
            streamId,
            streamType,
            streamLabel,
            messages,
            isPaidUser,
            editorNode,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled,
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
                                ? "Save these message as a file"
                                : "With Pro: Save these messages as a file"
                        }
                        disabled={!isPaidUser}
                        onClick={this.exportMessages}
                    />
                </CollapsingButtons>
                { streamLabel && <Pill
                    color={getSummaryColour('data')}
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
                    { streamType } messages
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
        saveFile(
            getFilename(this.props.filenamePrefix, this.someBinaryMessages),
            this.someBinaryMessages
                ? 'application/octet-stream'
                : 'text/plain',
            this.props.messages
                .map(m => m.content)
                .join('\n\n---\n\n')
        );
    };

    exportMessage = (message: StreamMessage) => {
        const filename = getFilename(
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
