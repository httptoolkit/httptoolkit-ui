import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { ExchangeMessage } from '../../types';

import { ErrorLike } from '../../util/error';
import { getHeaderValue, lastHeader } from '../../util/headers';

import { ViewableContentType, getCompatibleTypes } from '../../model/events/content-types';

import { ExpandableCardProps } from '../common/card';

import {
    ContainerSizedEditorCardContent,
    ReadonlyBodyCardHeader,
    getBodyDownloadFilename,
    BodyCodingErrorBanner
} from '../editor/body-card-components';
import { ContentViewer } from '../editor/content-viewer';

import { SendBodyCardSection, SentLoadingBodyCard } from './send-card-section';
import { ContainerSizedEditor } from '../editor/base-editor';

// A selection of content types you might want to try out, to explore your encoded data:
const ENCODED_DATA_CONTENT_TYPES = ['text', 'raw', 'base64', 'image'] as const;

// Closely based on the HTTP body card, but not identical (notably: different card container,
// different editor sizing logic within, and no directions)
@observer
export class SentResponseBodyCard extends React.Component<ExpandableCardProps & {
    onCollapseToggled: () => void,

    isPaidUser: boolean,
    url: string,
    message?: ExchangeMessage,
    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>
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
        if (contentType === this.props.message?.contentType) {
            this.selectedContentType = undefined;
        } else {
            this.selectedContentType = contentType;
        }
    }

    render() {
        const {
            url,
            message,
            isPaidUser,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled,
            ariaLabel
        } = this.props;

        const compatibleContentTypes = message
            ? getCompatibleTypes(
                message.contentType,
                lastHeader(message.headers['content-type']),
                message.body
            )
            : ['text'] as const;

        const decodedContentType = _.includes(compatibleContentTypes, this.selectedContentType)
            ? this.selectedContentType!
            : (message?.contentType ?? 'text');

        const decodedBody = message?.body.decoded;

        if (decodedBody) {
            // We have successfully decoded the body content, show it:
            return <SendBodyCardSection
                ariaLabel={ariaLabel}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={decodedBody}
                        mimeType={getHeaderValue(message.headers, 'content-type')}
                        downloadFilename={getBodyDownloadFilename(url, message.headers)}

                        title='Response body'
                        expanded={expanded}
                        onExpandToggled={onExpandToggled}
                        onCollapseToggled={onCollapseToggled}

                        selectedContentType={decodedContentType}
                        contentTypeOptions={compatibleContentTypes}
                        onChangeContentType={this.onChangeContentType}

                        isPaidUser={isPaidUser}
                    />
                </header>
                <ContainerSizedEditorCardContent>
                    <ContentViewer
                        contentId={message.id}
                        editorNode={this.props.editorNode}
                        rawContentType={lastHeader(message.headers['content-type'])}
                        contentType={decodedContentType}
                        expanded={!!expanded}
                        cache={message.cache}
                    >
                        {decodedBody}
                    </ContentViewer>
                </ContainerSizedEditorCardContent>
            </SendBodyCardSection>;
        } else if (!decodedBody && message?.body.decodingError) {
            // We have failed to decode the body content! Show the error & raw encoded data instead:
            const error = message.body.decodingError as ErrorLike;
            const encodedBody = Buffer.isBuffer(message.body.encoded)
                ? message.body.encoded
                : undefined;

            const encodedDataContentType = _.includes(ENCODED_DATA_CONTENT_TYPES, this.selectedContentType)
                ? this.selectedContentType!
                : 'text';

            return <SendBodyCardSection
                ariaLabel={ariaLabel}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={encodedBody}
                        mimeType={'application/octet-stream'} // Ignore content type, as it's encoded
                        downloadFilename={getBodyDownloadFilename(url, message.headers)}

                        title='Response body'
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
                    error={error}
                    headers={message.rawHeaders}
                />
                { encodedBody &&
                    <ContainerSizedEditorCardContent>
                        <ContentViewer
                            contentId={message.id}
                            editorNode={this.props.editorNode}
                            contentType={encodedDataContentType}
                            expanded={!!expanded}
                            cache={message.cache}
                        >
                            { encodedBody }
                        </ContentViewer>
                    </ContainerSizedEditorCardContent>
                }
            </SendBodyCardSection>;
        } else {
            // No body content, but no error yet, show a loading spinner:
            return <SentLoadingBodyCard
                ariaLabel={ariaLabel}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
            >
                <header>
                    <ReadonlyBodyCardHeader
                        body={undefined}

                        title='Response body'
                        expanded={expanded}
                        onExpandToggled={onExpandToggled}
                        onCollapseToggled={onCollapseToggled}

                        selectedContentType={decodedContentType}
                        contentTypeOptions={compatibleContentTypes}
                        onChangeContentType={this.onChangeContentType}
                        isPaidUser={isPaidUser}
                    />
                </header>
            </SentLoadingBodyCard>;
        }
    }

}