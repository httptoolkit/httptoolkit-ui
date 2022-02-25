import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';
import type { SchemaObject } from 'openapi-directory';
import * as portals from 'react-reverse-portal';

import { ExchangeMessage, HtkResponse, HtkRequest } from '../../types';
import { styled } from '../../styles';
import { lastHeader } from '../../util';
import { saveFile } from '../../util/ui';

import { ViewableContentType, getCompatibleTypes, getContentEditorName } from '../../model/http/content-types';
import { getReadableSize } from '../../model/http/bodies';

import { CollapsibleCardHeading } from '../common/card';
import { ExchangeCard, LoadingExchangeCard } from './exchange-card';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { Pill, PillSelector } from '../common/pill';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { ContentViewer } from '../editor/content-viewer';
import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { IconButton } from '../common/icon-button';

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

export const ExchangeBodyCardCard = styled(ExchangeCard)`
    display: flex;
    flex-direction: column;
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

@observer
export class ExchangeBodyCard extends React.Component<{
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
        const contentType = _.includes(compatibleContentTypes, this.selectedContentType) ?
            this.selectedContentType! : message.contentType;

        const decodedBody = message.body.decoded;

        return decodedBody ?
            <ExchangeBodyCardCard
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
                        value={contentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                        { title }
                    </CollapsibleCardHeading>
                </header>
                <EditorCardContent>
                    <ContentViewer
                        editorNode={this.props.editorNode}
                        rawContentType={lastHeader(message.headers['content-type'])}
                        contentType={contentType}
                        schema={apiBodySchema}
                        expanded={expanded}
                        cache={message.cache}
                    >
                        {decodedBody}
                    </ContentViewer>
                </EditorCardContent>
            </ExchangeBodyCardCard>
        :
            <LoadingExchangeCard
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                expanded={expanded}
                height={expanded ? 'auto' : '500px'}
            >
                <header>
                    <PillSelector<ViewableContentType>
                        onChange={this.setContentType}
                        value={contentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                        { title }
                    </CollapsibleCardHeading>
                </header>
            </LoadingExchangeCard>;
    }

}