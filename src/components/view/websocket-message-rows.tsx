import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled, warningColor } from '../../styles';
import { asBuffer } from '../../util';
import { ArrowIcon } from '../../icons';

import {
    ViewableContentType,
    getCompatibleTypes,
    getContentEditorName
} from '../../model/http/content-types';
import { getReadableSize } from '../../model/http/bodies';
import { WebSocketMessage } from '../../model/websockets/websocket-message';

import { ContentLabel, ContentMonoValue } from '../common/text-content';
import { Pill, PillSelector } from '../common/pill';
import { IconButton } from '../common/icon-button';

import { ContentViewer } from '../editor/content-viewer';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

const visualDirection = (message: WebSocketMessage) =>
    message.direction === 'sent'
        ? 'left'
        : 'right';


export const WebSocketMessageCollapsedRow = (p: {
    message: WebSocketMessage
    onClick: () => void
}) => <CollapsedWebSocketRowContainer
        messageDirection={visualDirection(p.message)}
        onClick={p.onClick}
    >
    <MessageArrow selected={false} messageDirection={visualDirection(p.message)} />
    <CollapsedWebSocketContent>
        {
            p.message.content
            // Limit the length - no point showing huge messages here. On a typical UI, we show about
            // 100 chars here, so this should give us a good bit of buffer
            .slice(0, 200)
            // Show everything as UTF-8 - binary data can be viewed up close instead.
            .toString('utf8')
        }
    </CollapsedWebSocketContent>
    {
        p.message.isBinary &&
            <Pill color={warningColor}>Binary</Pill>
    }
    <Pill>
        { getReadableSize(p.message.content.byteLength) }
    </Pill>
</CollapsedWebSocketRowContainer>;

const MessageArrow = styled((p: {
    className?: string,
    messageDirection: 'left' | 'right',
    selected: boolean
}) => {
    return <div className={p.className}>
        <ArrowIcon direction={p.messageDirection} />
    </div>
})`
    width: 25px;
    flex-grow: 0;
    flex-shrink: 0;

    padding-right: 1px;
    box-sizing: border-box;
    margin: -4px 0;

    > svg {
        padding: 0;
        color: ${p => p.selected
            ? p.theme.popColor
            : p.theme.containerBorder
        };
    }

    text-align: center;
`;

const CollapsedWebSocketRowContainer = styled.div<{ messageDirection: 'left' | 'right' }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    border-style: solid;
    border-width: 0 5px 1px;

    border-color: transparent;
    border-${p => p.messageDirection}-color: ${p => p.theme.containerBorder};
    border-bottom-color: ${p => p.theme.containerWatermark};

    cursor: pointer;
    &:hover {
        border-${p => p.messageDirection}-color: ${p => p.theme.popColor};
        background-color: ${p => p.theme.mainBackground};
    }

    padding: 4px 15px 4px 0;

    ${Pill} {
        flex-shrink: 0;
        &:last-of-type {
            margin-right: 0;
        }
    }
`;

const CollapsedWebSocketContent = styled(ContentMonoValue)`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex-grow: 1;
    width: auto;
    padding: 3px 0 4px;
`;

@observer
export class WebSocketMessageEditorRow extends React.Component<{
    message: WebSocketMessage,
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,
    isPaidUser: boolean,
    onExportMessage: (message: WebSocketMessage) => void
}> {

    @observable
    private selectedContentType: ViewableContentType | undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const message = this.props.message;

            if (!message) {
                this.setContentType(undefined);
                return;
            }
        }));
    }

    @action.bound
    setContentType(contentType: ViewableContentType | undefined) {
        if (contentType === this.props.message.contentType) {
            this.selectedContentType = undefined;
        } else {
            this.selectedContentType = contentType;
        }
    }

    render() {
        const { message, isPaidUser, onExportMessage, editorNode } = this.props;

        const compatibleContentTypes = getCompatibleTypes(
            message.contentType,
            undefined,
            asBuffer(message.content)
        );
        const contentType = _.includes(compatibleContentTypes, this.selectedContentType) ?
            this.selectedContentType! : message.contentType;

        const messageDirection = message.direction === 'sent' ? 'left' : 'right';

        return <EditorRowContainer>
            <EditorRowHeader messageDirection={messageDirection}>
                <MessageArrow selected={true} messageDirection={messageDirection} />
                <ContentLabel>
                    {message.direction === 'sent'
                        ? 'Received from server' // I.e. 'sent' by Mockttp
                        : 'Sent by client'
                    }:
                </ContentLabel>
                <IconButton
                    icon={['fas', 'download']}
                    title={
                        isPaidUser
                            ? "Save this message as a file"
                            : "With Pro: Save this message as a file"
                    }
                    disabled={!isPaidUser}
                    onClick={() => onExportMessage(message)}
                />
                <PillSelector<ViewableContentType>
                    onChange={this.setContentType}
                    value={contentType}
                    options={compatibleContentTypes}
                    nameFormatter={getContentEditorName}
                />
                <Pill>{ getReadableSize(message.content.byteLength) }</Pill>
            </EditorRowHeader>
            <EditorCardContent>
                <ContentViewer
                    editorNode={editorNode}
                    contentType={contentType}
                    cache={message.cache}
                    expanded={false}
                >
                    {message.content}
                </ContentViewer>
            </EditorCardContent>
        </EditorRowContainer>;
    }

}

const EditorRowContainer = styled.div`
    background-color: ${p => p.theme.mainBackground};
    border-bottom: 1px solid ${p => p.theme.containerWatermark};

    display: flex;
    flex-direction: column;
`;

const EditorRowHeader = styled.div<{ messageDirection: 'left' | 'right' }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    padding: 4px 15px 4px 0;

    cursor: pointer;

    border-style: solid;
    border-width: 0 5px 1px;

    border-color: transparent;
    border-${p => p.messageDirection}-color: ${p => p.theme.popColor};
    border-bottom-color: ${p => p.theme.containerWatermark};

    > ${ContentLabel} {
        flex-grow: 1;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    > ${IconButton} {
        margin: -5px 0;
    }

    ${Pill}, select {
        &:last-of-type {
            margin-right: 0;
        }
    }
`;

export const EditorCardContent = styled.div`
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }

    position: relative;
    flex-grow: 1;

    /*
    Allows shrinking smaller than content, to allow scrolling overflow e.g. for
    scrollable URL param content
    */
    min-height: 0;
`;