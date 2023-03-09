import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import type { SchemaObject } from 'openapi-directory';
import * as portals from 'react-reverse-portal';

import { ExchangeMessage, HtkResponse, HtkRequest } from '../../../types';
import { styled } from '../../../styles';
import { WarningIcon } from '../../../icons';

import { lastHeader } from '../../../util';
import { saveFile } from '../../../util/ui';
import { ErrorLike } from '../../../util/error';

import { ViewableContentType, getCompatibleTypes, getContentEditorName } from '../../../model/events/content-types';
import { getReadableSize } from '../../../model/events/bodies';

import {
    CollapsibleCardHeading,
    CollapsibleCard
} from '../../common/card';
import { CollapsingButtons } from '../../common/collapsing-buttons';
import { Pill, PillSelector } from '../../common/pill';
import { ExpandShrinkButton } from '../../common/expand-shrink-button';
import { IconButton } from '../../common/icon-button';
import { Content, ContentMonoValue } from '../../common/text-content';

import { LoadingCard } from '../loading-card';
import { ContentViewer } from '../../editor/content-viewer';
import { ThemedSelfSizedEditor } from '../../editor/base-editor';

export const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
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

function getFilename(url: string, message: HtkResponse | HtkRequest): string | undefined {
    const contentDisposition = lastHeader(message.headers['content-disposition']) || "";
    const filenameMatch = / filename="([^"]+)"/.exec(contentDisposition);

    if (filenameMatch) {
        const suggestedFilename = filenameMatch[1];
        return _.last(_.last(suggestedFilename.split('/') as string[])!.split('\\')); // Strip any path info
    }

    const urlBaseName = _.last(url.split('/'));
    if (urlBaseName?.includes(".")) return urlBaseName;
}

const ErrorBanner = styled(Content)<{ direction: 'left' | 'right' }>`
    ${p => p.direction === 'left'
        ? 'margin: 0 -20px 0 -15px;'
        : 'margin: 0 -15px 0 -20px;'
    }

    padding: 10px 30px 0;

    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    background-color: ${p => p.theme.warningBackground};
    border-top: solid 1px ${p => p.theme.containerBorder};

    svg {
        margin-left: 0;
    }
`;

const ErrorMessage = styled(ContentMonoValue)`
    padding: 0;
    margin: 10px 0;
`;

// A selection of content types you might want to try out, to explore your encoded data:
const ENCODED_DATA_CONTENT_TYPES = ['text', 'raw', 'base64', 'image'] as const;

@observer
export class HttpBodyCard extends React.Component<{
    title: string,
    direction: 'left' | 'right',
    collapsed: boolean,
    expanded: boolean,
    onCollapseToggled: () => void,
    onExpandToggled: () => void,

    isPaidUser: boolean,
    url: string,
    message: ExchangeMessage,
    apiBodySchema?: SchemaObject,
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>
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
        const {
            title,
            url,
            message,
            apiBodySchema,
            direction,
            isPaidUser,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled
        } = this.props;

        const compatibleContentTypes = getCompatibleTypes(
            message.contentType,
            lastHeader(message.headers['content-type']),
            message.body
        );
        const decodedContentType = _.includes(compatibleContentTypes, this.selectedContentType)
            ? this.selectedContentType!
            : message.contentType;

        const decodedBody = message.body.decoded;

        if (decodedBody) {
            // We have successfully decoded the body content, show it:
            return <CollapsibleCard
                direction={direction}
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
                                    ? "Save this body as a file"
                                    : "With Pro: Save this body as a file"
                            }
                            disabled={!isPaidUser}
                            onClick={() => saveFile(
                                getFilename(url, message) || "",
                                lastHeader(message.headers['content-type']) ||
                                    'application/octet-stream',
                                decodedBody
                            )}
                        />
                    </CollapsingButtons>
                    <Pill>{ getReadableSize(decodedBody.byteLength) }</Pill>
                    <PillSelector<ViewableContentType>
                        onChange={this.setContentType}
                        value={decodedContentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                        { title }
                    </CollapsibleCardHeading>
                </header>
                <EditorCardContent>
                    <ContentViewer
                        contentId={`${message.id}-${direction}`}
                        editorNode={this.props.editorNode}
                        rawContentType={lastHeader(message.headers['content-type'])}
                        contentType={decodedContentType}
                        schema={apiBodySchema}
                        expanded={expanded}
                        cache={message.cache}
                    >
                        {decodedBody}
                    </ContentViewer>
                </EditorCardContent>
            </CollapsibleCard>;
        } else if (!decodedBody && message.body.decodingError) {
            // We have failed to decode the body content! Show the error & raw encoded data instead:
            const error = message.body.decodingError as ErrorLike;
            const encodedBody = Buffer.isBuffer(message.body.encoded)
                ? message.body.encoded
                : undefined;

            const encodedDataContentType = _.includes(ENCODED_DATA_CONTENT_TYPES, this.selectedContentType)
                ? this.selectedContentType!
                : 'text';

            return <CollapsibleCard
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    { encodedBody && <>
                        <CollapsingButtons>
                            <ExpandShrinkButton
                                expanded={expanded}
                                onClick={onExpandToggled}
                            />
                            <IconButton
                                icon={['fas', 'download']}
                                title={
                                    isPaidUser
                                        ? "Save this body as a file"
                                        : "With Pro: Save this body as a file"
                                }
                                disabled={!isPaidUser}
                                onClick={() => saveFile(
                                    getFilename(url, message) || "",
                                    'application/octet-stream', // Ignore content type, as it's encoded
                                    encodedBody
                                )}
                            />
                        </CollapsingButtons>
                        <Pill>{ getReadableSize(encodedBody.byteLength) }</Pill>
                    </> }
                    <PillSelector<ViewableContentType>
                        onChange={this.setContentType}
                        value={encodedDataContentType}
                        // A selection of maybe-useful decodings you can try out regardless:
                        options={ENCODED_DATA_CONTENT_TYPES}
                        nameFormatter={getContentEditorName}
                    />
                    <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                        { title }
                    </CollapsibleCardHeading>
                </header>
                <ErrorBanner direction={this.props.direction}>
                    <p>
                        <WarningIcon/> Body decoding failed for encoding '{message.headers['content-encoding']}' due to:
                    </p>
                    <ErrorMessage>{ error.code ? `${error.code}: ` : '' }{ error.message || error.toString() }</ErrorMessage>
                    <p>
                        This typically means either the <code>content-encoding</code> header is incorrect or unsupported, or the body
                        was corrupted. The raw content (not decoded) is shown below.
                    </p>
                </ErrorBanner>
                { encodedBody &&
                    <EditorCardContent>
                        <ContentViewer
                            contentId={`${message.id}-${direction}`}
                            editorNode={this.props.editorNode}
                            contentType={encodedDataContentType}
                            expanded={expanded}
                            cache={message.cache}
                        >
                            { encodedBody }
                        </ContentViewer>
                    </EditorCardContent>
                }
            </CollapsibleCard>;
        } else {
            // No body content, but no error yet, show a loading spinner:
            return <LoadingCard
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
                height={expanded ? 'auto' : '500px'}
            >
                <header>
                    <PillSelector<ViewableContentType>
                        onChange={this.setContentType}
                        value={decodedContentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                        { title }
                    </CollapsibleCardHeading>
                </header>
            </LoadingCard>;
        }
    }

}