import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled, warningColor } from '../../styles';
import { asBuffer, bufferToString } from '../../util/buffer';
import { ArrowIcon } from '../../icons';

import {
    ViewableContentType,
    getCompatibleTypes,
    getContentEditorName
} from '../../model/events/content-types';
import { getReadableSize } from '../../util/buffer';
import { StreamMessage } from '../../model/events/stream-message';

import { ContentLabel, ContentMonoValue } from '../common/text-content';
import { Pill, PillSelector } from '../common/pill';
import { IconButton } from '../common/icon-button';

import { ContentViewer } from '../editor/content-viewer';
import { SelfSizedEditor } from '../editor/base-editor';
import { EditorCardContent } from '../editor/body-card-components';

const visualDirection = (message: StreamMessage) =>
    message.direction === 'sent'
        ? 'left'
        : 'right';


export const StreamMessageCollapsedRow = React.memo((p: {
    message: StreamMessage
    index: number,
    onClick: (index: number) => void
}) => <CollapsedStreamRowContainer
        messageDirection={visualDirection(p.message)}
        onClick={() => p.onClick(p.index)}

        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter') p.onClick(p.index);

            // If focused, up/down move up & down the list. This is slightly different from
            // tab focus: it stops at the ends, and moving to an open editor row focuses the
            // entire row (jumping to the editor only on 'enter').
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                (e.currentTarget.nextElementSibling as HTMLElement)?.focus?.();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLElement)?.focus?.();
            }
        }}
    >
    <MessageArrow selected={false} messageDirection={visualDirection(p.message)} />
    <CollapsedStreamContent>
        {
            bufferToString( // Show everything as UTF-8 - binary data can be viewed up close instead.
                p.message.content
                // Limit the length - no point showing huge messages here. On a typical UI, we show about
                // 100 chars here, so this should give us a good bit of buffer
                .slice(0, 200)
            )
        }
    </CollapsedStreamContent>
    {
        p.message.isBinary &&
            <Pill color={warningColor}>Binary</Pill>
    }
    <Pill>
        { getReadableSize(p.message.content.byteLength) }
    </Pill>
</CollapsedStreamRowContainer>);

const MessageArrow = styled(React.memo((p: {
    className?: string,
    messageDirection: 'left' | 'right',
    selected: boolean
}) => {
    return <div className={p.className}>
        <ArrowIcon direction={p.messageDirection} />
    </div>
}))`
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

const CollapsedStreamRowContainer = styled.div<{ messageDirection: 'left' | 'right' }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    border-style: solid;
    border-width: 0 5px 1px;

    border-color: transparent;
    border-${p => p.messageDirection}-color: ${p => p.theme.containerBorder};
    border-bottom-color: ${p => p.theme.containerWatermark};

    cursor: pointer;
    &:hover, &:focus {
        outline: none;
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

const CollapsedStreamContent = styled(ContentMonoValue)`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex-grow: 1;
    width: auto;
    padding: 3px 0 4px;
`;

interface MessageEditorRowProps {
    streamId: string,
    message: StreamMessage,
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    isPaidUser: boolean,
    onExportMessage: (message: StreamMessage) => void
}

@observer
export class StreamMessageEditorRow extends React.Component<MessageEditorRowProps> {

    @observable
    private selectedContentType: ViewableContentType | undefined;

    private containerRef = React.createRef<HTMLDivElement>();

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const message = this.props.message;

            if (!message) {
                this.setContentType(undefined);
                return;
            }
        }));

        this.onMessageChanged();
    }

    componentDidUpdate(prevProps: MessageEditorRowProps) {
        if (prevProps?.message.messageIndex !== this.props.message.messageIndex) {
            this.onMessageChanged();
        }
    }

    onMessageChanged() {
        // We've just changed message - scroll to show this editor fully and
        // focus the contained editor itself.
        const container = this.containerRef.current!;

        container.scrollIntoView({
            behavior: 'smooth',
        });

        const editor = container.querySelector('.monaco-editor textarea');
        if (editor) {
            (editor as HTMLElement).focus();
        } else {
            // If the editor content needs formatting, e.g. for JSON messages, the editor itself won't
            // yet be visible. In this case, we'll focus the container instead, and jump to the editor
            // when onContentRendered fires from the content viewer.
            container.focus();
        }
    }

    onEditorContentRendered = () => {
        // Only if the row is focused (not any buttons within etc) and the content has just rendered then
        // you should jump to it. This should only happen if the editor content was not visible initially.
        if (this.containerRef.current === document.activeElement) {
            const editor = this.containerRef.current?.querySelector('.monaco-editor textarea');
            (editor as HTMLElement | undefined)?.focus();
        }
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
        const { message, isPaidUser, onExportMessage, editorNode, streamId } = this.props;

        const compatibleContentTypes = getCompatibleTypes(
            message.contentType,
            undefined,
            asBuffer(message.content)
        );

        const contentType = _.includes(compatibleContentTypes, this.selectedContentType)
            ? this.selectedContentType!
            : message.contentType;

        const messageDirection = message.direction === 'sent' ? 'left' : 'right';

        return <EditorRowContainer
            ref={this.containerRef}
            tabIndex={-1} // Only ever focused by up/down on other rows
            onKeyDown={(e) => {
                // Only listen to events where the entire row is specifically focused:
                if (e.target !== e.currentTarget) return;

                // When focused (via up/down) if you press enter is jumps to the content. That means
                // you can up/down past this no problem, or press enter and then move to tab-based
                // control back to the rows, and then up/down again.
                else if (e.target === e.currentTarget && e.key === 'Enter') {
                    const editor = (e.target as HTMLElement).querySelector('.monaco-editor textarea');
                    (editor as HTMLElement | undefined)?.focus();
                }

                // TODO: It would be nice to allow Escape here to exit the editor, but because it's a portal, the keydown
                // events don't actually bubble back up here. Might be worth re-investigating this after eventually
                // fixing https://github.com/httptoolkit/react-reverse-portal/issues/13. Not easy though.

                // Keep the same up/down behaviour as the collapsed rows
                else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    (e.currentTarget.nextElementSibling as HTMLElement)?.focus?.();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    (e.currentTarget.previousElementSibling as HTMLElement)?.focus?.();
                }
            }}
        >
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
            <RowEditorContent>
                <ContentViewer
                    contentId={`ws-${streamId}-${message.messageIndex}`}
                    editorNode={editorNode}
                    contentType={contentType}
                    cache={message.cache}
                    expanded={false}
                    onContentRendered={this.onEditorContentRendered}
                >
                    {message.content}
                </ContentViewer>
            </RowEditorContent>
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
    gap: 8px;

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

        margin-left: -8px;
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

const RowEditorContent = styled(EditorCardContent)`
    /* Undo the whole-card specific bits of styling */
    border-top: none;
    margin: 0;
`;