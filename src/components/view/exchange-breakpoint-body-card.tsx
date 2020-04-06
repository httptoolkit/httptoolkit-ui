import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, reaction } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { Headers, BreakpointBody } from '../../types';
import { styled } from '../../styles';
import { lastHeader } from '../../util';
import {
    EditableContentType,
    EditableContentTypes,
    getEditableContentType,
    getContentEditorName
} from '../../model/http/content-types';
import { getReadableSize } from '../../model/http/bodies';

import { CollapsibleCardHeading } from '../common/card';
import { ExchangeCard } from './exchange-card';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { Pill, PillSelector } from '../common/pill';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

@observer
export class ExchangeBreakpointBodyCard extends React.Component<{
    title: string,
    direction: 'left' | 'right',
    collapsed: boolean,
    expanded: boolean,
    onCollapseToggled: () => void,
    onExpandToggled: () => void,

    body: Buffer,
    headers: Headers,
    onChange: (result: string) => void,
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

    render() {
        const {
            body,
            title,
            direction,
            collapsed,
            expanded,
            onCollapseToggled,
            onExpandToggled
        } = this.props;

        return <ExchangeCard
            direction={direction}
            collapsed={collapsed}
            onCollapseToggled={onCollapseToggled}
        >
            <header>
                <CollapsingButtons>
                    <ExpandShrinkButton
                        expanded={expanded}
                        onClick={onExpandToggled}
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
                    node={this.props.editorNode}
                    language={this.contentType}
                    value={body.toString('utf8')}
                    onChange={this.props.onChange}
                />
            </EditorCardContent>
        </ExchangeCard>;
    }

}