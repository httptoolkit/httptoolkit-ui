import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';

import { bufferToString, isProbablyUtf8, stringToBuffer } from '../../util';

import { EditableContentType, EditableContentTypes } from '../../model/events/content-types';

import { CollapsibleCardProps } from '../common/card';
import { SendBodyCardSection } from './send-card-section';
import { ContainerSizedEditor } from '../editor/base-editor';
import {
    EditableBodyCardHeader,
    ContainerSizedEditorCardContent
} from '../editor/body-card-components';

export interface SendRequestBodyProps extends CollapsibleCardProps {
    body: Buffer;
    onBodyUpdated: (body: Buffer) => void;
    expanded: boolean;
    onCollapseToggled: () => void;
    onExpandToggled: () => void;

    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>;
}

@observer
export class SendRequestBodyCard extends React.Component<SendRequestBodyProps> {

    @observable
    private contentType: EditableContentType = 'text';

    @action.bound
    onChangeContentType(value: string) {
        this.contentType = value as EditableContentType;
    }

    @computed
    get textEncoding() {
        return isProbablyUtf8(this.props.body)
            ? 'utf8'
            : 'binary';
    }

    updateBody = (input: string) => {
        this.props.onBodyUpdated(
            stringToBuffer(input, this.textEncoding)
        );
    }

    render() {
        const {
            editorNode,
            expanded,
            onExpandToggled,
            onCollapseToggled,
            body
        } = this.props;

        const bodyString = bufferToString(body, this.textEncoding);

        return <SendBodyCardSection
            {...this.props}
            headerAlignment='left'
        >
            <header>
                <EditableBodyCardHeader
                    body={body}
                    onBodyFormatted={this.updateBody}

                    title='Request body'
                    expanded={expanded}
                    onExpandToggled={onExpandToggled}
                    onCollapseToggled={onCollapseToggled}

                    selectedContentType={this.contentType}
                    contentTypeOptions={EditableContentTypes}
                    onChangeContentType={this.onChangeContentType}
                />
            </header>
            <ContainerSizedEditorCardContent>
                <portals.OutPortal<typeof ContainerSizedEditor>
                    node={editorNode}

                    contentId='request'
                    language={this.contentType}
                    value={bodyString}
                    onChange={this.updateBody}
                />
            </ContainerSizedEditorCardContent>
        </SendBodyCardSection>;
    }
}