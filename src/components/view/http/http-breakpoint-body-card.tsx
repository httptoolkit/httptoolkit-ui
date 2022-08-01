import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, reaction, computed } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { Headers } from '../../../types';
import { lastHeader, isProbablyUtf8 } from '../../../util';
import {
    EditableContentType,
    EditableContentTypes,
    getEditableContentType,
    getContentEditorName
} from '../../../model/events/content-types';
import { getReadableSize } from '../../../model/events/bodies';

import { CollapsibleCard, CollapsibleCardHeading } from '../../common/card';
import { CollapsingButtons } from '../../common/collapsing-buttons';
import { Pill, PillSelector } from '../../common/pill';
import { ExpandShrinkButton } from '../../common/expand-shrink-button';
import { FormatButton } from '../../common/format-button';
import { ThemedSelfSizedEditor } from '../../editor/base-editor';
import { EditorCardContent } from './http-body-card';

@observer
export class HttpBreakpointBodyCard extends React.Component<{
    title: string,
    direction: 'left' | 'right',
    collapsed: boolean,
    expanded: boolean,
    onCollapseToggled: () => void,
    onExpandToggled: () => void,

    exchangeId: string,
    body: Buffer,
    headers: Headers,
    onChange: (result: Buffer) => void,
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>;
}> {

    @observable
    private contentType: EditableContentType = 'text';

    @action.bound
    setContentType(value: string) {
        this.contentType = value as EditableContentType;
    }

    componentDidMount() {
        // If the content header is changed (manually, or when switching requests), update the
        // selected editor content type to match:
        disposeOnUnmount(this, reaction(() => lastHeader(this.props.headers['content-type']), (contentTypeHeader) => {
            this.contentType = getEditableContentType(contentTypeHeader) || 'text';
        }, { fireImmediately: true }));
    }

    @computed
    private get textEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        return isProbablyUtf8(this.props.body)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const {
            body,
            title,
            exchangeId,
            direction,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled
        } = this.props;

        const bodyString = body.toString(this.textEncoding);

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
                    <FormatButton
                        format={this.contentType}
                        content={body}
                        onFormatted={this.onBodyChange}
                    />
                </CollapsingButtons>

                <Pill>{ getReadableSize(body.byteLength) }</Pill>
                <PillSelector<EditableContentType>
                    onChange={this.setContentType}
                    value={this.contentType}
                    options={EditableContentTypes}
                    nameFormatter={getContentEditorName}
                />
                <CollapsibleCardHeading onCollapseToggled={onCollapseToggled}>
                    { title }
                </CollapsibleCardHeading>
            </header>
            <EditorCardContent>
                <portals.OutPortal<typeof ThemedSelfSizedEditor>
                    contentId={`bp-${exchangeId}-${direction}`}
                    node={this.props.editorNode}
                    language={this.contentType}
                    value={bodyString}
                    onChange={this.onBodyChange}
                    expanded={expanded}
                />
            </EditorCardContent>
        </CollapsibleCard>;
    }

    private onBodyChange = (body: string) => {
        this.props.onChange(Buffer.from(body, this.textEncoding));
    }

}