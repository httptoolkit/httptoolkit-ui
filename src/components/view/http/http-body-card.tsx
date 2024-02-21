import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import type { SchemaObject } from 'openapi-directory';
import * as portals from 'react-reverse-portal';

import { ExchangeMessage } from '../../../types';

import { ErrorLike } from '../../../util/error';
import { getHeaderValue, lastHeader } from '../../../util/headers';

import { ViewableContentType, getCompatibleTypes } from '../../../model/events/content-types';

import { CollapsibleCard, ExpandableCardProps } from '../../common/card';

import {
    EditorCardContent,
    ReadonlyBodyCardHeader,
    getBodyDownloadFilename,
    BodyCodingErrorBanner
} from '../../editor/body-card-components';

import { LoadingCard } from '../../common/loading-card';
import { ContentViewer } from '../../editor/content-viewer';
import { SelfSizedEditor } from '../../editor/base-editor';

// A selection of content types you might want to try out, to explore your encoded data:
const ENCODED_DATA_CONTENT_TYPES = ['text', 'raw', 'base64', 'image'] as Array<ViewableContentType>;

@observer
export class HttpBodyCard extends React.Component<ExpandableCardProps & {
    title: string,
    direction?: 'left' | 'right',
    onCollapseToggled: () => void,

    isPaidUser: boolean,
    url: string,
    message: ExchangeMessage,
    apiBodySchema?: SchemaObject,
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor>
}> {

    @observable
    private selectedContentType: ViewableContentType | undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const message = this.props.message;

            if (!message) {
                this.onChangeContentType(undefined);
                return;
            }
        }));
    }

    @action.bound
    onChangeContentType(contentType: ViewableContentType | undefined) {
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
            onExpandToggled,
            ariaLabel
        } = this.props;

        const compatibleContentTypes = getCompatibleTypes(
            message.contentType,
            lastHeader(message.headers['content-type']),
            message.body
        );
        const decodedContentType = compatibleContentTypes.includes(this.selectedContentType!)
            ? this.selectedContentType!
            : message.contentType;

        const decodedBody = message.body.decoded;

        if (decodedBody) {
            // We have successfully decoded the body content, show it:
            return <CollapsibleCard
                ariaLabel={ariaLabel}
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={decodedBody}
                        mimeType={getHeaderValue(message.headers, 'content-type')}
                        downloadFilename={getBodyDownloadFilename(url, message.headers)}

                        title={title}
                        expanded={!!expanded}
                        onExpandToggled={onExpandToggled}
                        onCollapseToggled={onCollapseToggled}

                        selectedContentType={decodedContentType}
                        contentTypeOptions={compatibleContentTypes}
                        onChangeContentType={this.onChangeContentType}

                        isPaidUser={isPaidUser}
                    />
                </header>
                <EditorCardContent>
                    <ContentViewer
                        contentId={`${message.id}-${direction}`}
                        editorNode={this.props.editorNode}
                        rawContentType={lastHeader(message.headers['content-type'])}
                        contentType={decodedContentType}
                        schema={apiBodySchema}
                        expanded={!!expanded}
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

            const encodedDataContentType = ENCODED_DATA_CONTENT_TYPES.includes(this.selectedContentType!)
                ? this.selectedContentType!
                : 'text';

            return <CollapsibleCard
                ariaLabel={ariaLabel}
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={encodedBody}
                        mimeType={'application/octet-stream'} // Ignore content type, as it's encoded
                        downloadFilename={getBodyDownloadFilename(url, message.headers)}

                        title={title}
                        expanded={expanded}
                        onExpandToggled={onExpandToggled}
                        onCollapseToggled={onCollapseToggled}

                        selectedContentType={encodedDataContentType}
                        contentTypeOptions={ENCODED_DATA_CONTENT_TYPES}
                        onChangeContentType={this.onChangeContentType}

                        isPaidUser={isPaidUser}
                    />
                </header>
                <BodyCodingErrorBanner
                    type='decoding'
                    direction={this.props.direction}
                    error={error}
                    headers={message.rawHeaders}
                />
                { encodedBody &&
                    <EditorCardContent>
                        <ContentViewer
                            contentId={`${message.id}-${direction}`}
                            editorNode={this.props.editorNode}
                            contentType={encodedDataContentType}
                            expanded={!!expanded}
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
                ariaLabel={ariaLabel}
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={undefined}

                        title={title}
                        expanded={!!expanded}
                        onExpandToggled={onExpandToggled}
                        onCollapseToggled={onCollapseToggled}

                        selectedContentType={decodedContentType}
                        contentTypeOptions={compatibleContentTypes}
                        onChangeContentType={this.onChangeContentType}
                        isPaidUser={isPaidUser}
                    />
                </header>
            </LoadingCard>;
        }
    }

}