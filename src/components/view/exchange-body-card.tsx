import * as _ from 'lodash';
import * as React from 'react';
import { observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer, inject } from 'mobx-react';
import { SchemaObject } from 'openapi-directory';

import { ExchangeMessage } from '../../types';
import { styled } from '../../styles';
import { HtkContentType, getCompatibleTypes } from '../../content-types';
import { getReadableSize, getDecodedBody } from '../../model/bodies';
import { UiStore } from '../../model/ui-store';

import { ExchangeCard, LoadingExchangeCard } from './exchange-card';
import { Pill, PillSelector } from '../common/pill';
import { CopyButton } from '../common/copy-button';
import { ContentEditor, getContentEditorName } from '../editor/content-editor';

const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

const CopyBody = styled(CopyButton)`
    padding: 5px 10px;
    margin-right: auto;
    color: ${p => p.theme.mainColor};
`;

@inject('uiStore')
@observer
export class ExchangeBodyCard extends React.Component<{
    title: string,
    message: ExchangeMessage,
    apiBodySchema?: SchemaObject,
    direction: 'left' | 'right',
    collapsed: boolean,
    onCollapseToggled: () => void,
    uiStore?: UiStore
}> {

    @observable
    private selectedContentType: HtkContentType | undefined;

    /*
     * Bit of a hack... We pass an observable down into the child editor component, who
     * writes to it when they've got rendered content (or not), which automatically
     * updates the copy button's rendered content.
     */
    private currentContent = observable.box<string | undefined>();

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
    setContentType(contentType: HtkContentType | undefined) {
        if (contentType === this.props.message.contentType) {
            this.selectedContentType = undefined;
        } else {
            this.selectedContentType = contentType;
        }
    }

    render() {
        const {
            title,
            message,
            apiBodySchema,
            direction,
            collapsed,
            onCollapseToggled,
            uiStore
        } = this.props;

        const compatibleContentTypes = getCompatibleTypes(message.contentType, message.headers['content-type']);
        const contentType = _.includes(compatibleContentTypes, this.selectedContentType) ?
            this.selectedContentType! : message.contentType;

        const decodedBody = getDecodedBody(message);

        const currentRenderedContent = this.currentContent.get();

        return decodedBody ?
            <ExchangeCard
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
            >
                <header>
                    { !collapsed && currentRenderedContent &&
                        // Can't show when collapsed, because no editor means the content might be outdated...
                        // TODO: Fine a nicer solution that doesn't depend on the editor
                        // Maybe refactor content rendering out, and pass the rendered result _down_ instead?
                        <CopyBody content={currentRenderedContent} />
                    }
                    <Pill>{ getReadableSize(decodedBody.length) }</Pill>
                    <PillSelector<HtkContentType>
                        onChange={this.setContentType}
                        value={contentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <h1>{ title }</h1>
                </header>
                <EditorCardContent>
                    <ContentEditor
                        rawContentType={message.headers['content-type']}
                        contentType={contentType}
                        contentObservable={this.currentContent}
                        monacoTheme={uiStore!.theme.monacoTheme}
                        schema={apiBodySchema}
                    >
                        {decodedBody}
                    </ContentEditor>
                </EditorCardContent>
            </ExchangeCard>
        :
            <LoadingExchangeCard
                direction={direction}
                collapsed={collapsed}
                onCollapseToggled={onCollapseToggled}
                height='500px'
            >
                <header>
                    <PillSelector<HtkContentType>
                        onChange={this.setContentType}
                        value={contentType}
                        options={compatibleContentTypes}
                        nameFormatter={getContentEditorName}
                    />
                    <h1>{ title }</h1>
                </header>
            </LoadingExchangeCard>;
    }

}