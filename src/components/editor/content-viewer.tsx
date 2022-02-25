import * as React from 'react';
import * as _ from 'lodash';
import { observer } from 'mobx-react';
import { computed } from 'mobx';
import { SchemaObject } from 'openapi3-ts';
import * as portals from 'react-reverse-portal';

import { css, styled } from '../../styles';
import { ObservablePromise, isObservablePromise } from '../../util/observable';

import { ViewableContentType } from '../../model/http/content-types';
import { Formatters, isEditorFormatter } from '../../model/http/body-formatting';

import { ThemedSelfSizedEditor } from './base-editor';
import { LoadingCardContent } from '../view/exchange-card';

interface ContentViewerProps {
    children: Buffer | string;
    schema?: SchemaObject;
    expanded: boolean;
    rawContentType?: string;
    contentType: ViewableContentType;
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>;
    cache: Map<Symbol, unknown>;
}

const ViewerContainer = styled.div<{ scrollable: boolean }>`
    ${p => p.scrollable ?
        css`
            overflow-y: auto;
            max-height: 100%;
        ` : ''
    }
`;

@observer
export class ContentViewer extends React.Component<ContentViewerProps> {

    constructor(props: ContentViewerProps) {
        super(props);
    }

    @computed
    private get formatter() {
        return Formatters[this.props.contentType] || Formatters.text!;
    }

    @computed
    private get contentBuffer() {
        return _.isString(this.props.children)
            ? Buffer.from(this.props.children)
            : this.props.children;
    }

    // Returns a string, if the rendered content is immediately available or has previously been generated
    // and cached. Returns an observable promise if rendering is still in progress.
    @computed
    private get renderedContent() {
        if (!isEditorFormatter(this.formatter)) return;

        const { cache } = this.props;
        const cacheKey = this.formatter.cacheKey;
        const cachedValue = cache.get(cacheKey) as ObservablePromise<string> | string | undefined;

        const renderingContent = cachedValue ||
            this.formatter.render(this.contentBuffer) as ObservablePromise<string> | string;
        if (!cachedValue) cache.set(cacheKey, renderingContent);

        if (typeof renderingContent === 'string') {
            return renderingContent;
        } else {
            if (renderingContent.state === 'fulfilled') {
                return renderingContent.value as string;
            } else if (renderingContent.state === 'rejected') {
                throw renderingContent.value;
            } else {
                return renderingContent;
            }
        }
    }

    private readonly editorOptions = {
        readOnly: true
    };

    render() {
        if (isEditorFormatter(this.formatter)) {
            try {
                const content = this.renderedContent;
                if (isObservablePromise<string>(content)) {
                    return <LoadingCardContent height='500px' />;
                } else {
                    return <portals.OutPortal<typeof ThemedSelfSizedEditor>
                        node={this.props.editorNode}
                        options={this.editorOptions}
                        language={this.formatter.language}
                        value={content!}
                        schema={this.props.schema}
                        expanded={this.props.expanded}
                    />;
                }
            } catch (e) {
                return <div>
                    Failed to render {this.props.contentType} content:<br/>
                    {e.toString()}
                </div>;
            }
        } else {
            const formatterConfig = this.formatter;
            return <ViewerContainer scrollable={!!formatterConfig.scrollable}>
                <formatterConfig.Component
                    expanded={this.props.expanded}
                    content={this.contentBuffer}
                    rawContentType={this.props.rawContentType}
                />
            </ViewerContainer>;
        }
    }
}
