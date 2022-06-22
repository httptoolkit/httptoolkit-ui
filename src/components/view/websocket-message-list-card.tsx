import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { saveFile } from '../../util/ui';
import { WebSocketMessage } from '../../model/websockets/websocket-message';

import { Pill } from '../common/pill';
import { IconButton } from '../common/icon-button';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { CollapsibleCardHeading } from '../common/card';
import { ExchangeCard } from './exchange-card';

import { ThemedSelfSizedEditor } from '../editor/base-editor';
import {
    WebSocketMessageCollapsedRow,
    WebSocketMessageEditorRow
} from './websocket-message-rows';

export const WebSocketMessageListCardCard = styled(ExchangeCard)`
    display: flex;
    flex-direction: column;
`;

function getFilename(
    url: string,
    someBinary: boolean,
    messageIndex?: number
) {
    const urlParts = url.split('/');
    const domain = urlParts[2].split(':')[0];
    const baseName = urlParts.length >= 2 ? urlParts[urlParts.length - 1] : undefined;

    const extension = someBinary ? 'bin' : 'txt';

    return `${domain}${baseName ? `- ${baseName}` : ''} - websocket ${
        messageIndex ? `message ${messageIndex}` : 'messages'
    }.${extension}`;
}

@observer
export class WebSocketMessageListCard extends React.Component<{
    collapsed: boolean,
    expanded: boolean,
    onCollapseToggled: () => void,
    onExpandToggled: () => void,

    isPaidUser: boolean,
    url: string,
    messages: Array<WebSocketMessage>,
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>
}> {

    @observable
    expandedRow: number | undefined = undefined;

    render() {
        const {
            url,
            messages,
            isPaidUser,
            editorNode,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled
        } = this.props;

        const someMessageBinary = messages.some(m => m.isBinary);

        return <WebSocketMessageListCardCard
            collapsed={collapsed}
            onCollapseToggled={onCollapseToggled}
            expanded={expanded}
        >
            <header>
                <CollapsingButtons>
                    <ExpandShrinkButton
                        expanded={expanded}
                        onClick={onExpandToggled}
                    />
                    <IconButton
                        icon={['fas', 'download']}
                        title={
                            isPaidUser
                                ? "Save these message as a file"
                                : "With Pro: Save these messages as a file"
                        }
                        disabled={!isPaidUser}
                        onClick={() => saveFile(
                            getFilename(url, someMessageBinary),
                            someMessageBinary
                                ? 'application/octet-stream'
                                : 'text/plain',
                            messages
                                .map(m => m.content)
                                .join('\n\n---\n\n')
                        )}
                    />
                </CollapsingButtons>
                <Pill>{ messages.length } messages</Pill>
                <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                    WebSocket messages
                </CollapsibleCardHeading>
            </header>
            <WebSocketMessagesList expanded={expanded}>
                {
                    messages.map((message, i) =>
                        this.expandedRow === i
                        ? <WebSocketMessageEditorRow
                            key='expanded' // Constant, which preserves content type between rows
                            message={message}

                            isPaidUser={isPaidUser}
                            onExportMessage={this.exportMessage}
                            editorNode={editorNode}
                        />
                        : <WebSocketMessageCollapsedRow
                            key={i}
                            message={message}
                            onClick={() => this.expandRow(i)}
                        />
                    )
                }
            </WebSocketMessagesList>
        </WebSocketMessageListCardCard>;
    }

    @action.bound
    expandRow(index: number) {
        this.expandedRow = index;
    }

    exportMessage = (message: WebSocketMessage) => {
        saveFile(
            getFilename(this.props.url, message.isBinary, this.props.messages.indexOf(message)),
            message.isBinary
                ? 'application/octet-stream'
                : 'text/plain',
            message.content
        );
    }

}

const WebSocketMessagesList = styled.div<{ expanded: boolean }>`
    width: calc(100% + 40px);
    margin: 0 -20px -20px -20px;

    border-top: solid 1px ${p => p.theme.containerWatermark};
    background-color: ${p => p.theme.mainLowlightBackground};

    display: flex;
    flex-direction: column;
    white-space: nowrap;

    position: relative;
    ${p => p.expanded && `
        left: 0;
        right: 0;
        bottom: 0;
        height: auto !important;
        overflow-y: auto;
    `}
`;