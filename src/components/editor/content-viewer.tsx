import * as React from 'react';
import * as _ from 'lodash';
import { observer } from 'mobx-react';
import { computed, ObservableMap } from 'mobx';
import { SchemaObject } from 'openapi3-ts';
import * as portals from 'react-reverse-portal';

import { ViewableContentType } from '../../model/http/content-types';
import { Formatters, isEditorFormatter } from '../../model/http/body-formatting';

import { ThemedSelfSizedEditor } from './base-editor';

interface ContentViewerProps {
    children: Buffer | string;
    schema?: SchemaObject;
    expanded: boolean;
    rawContentType?: string;
    contentType: ViewableContentType;
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>;
    cache: ObservableMap<Symbol, unknown>;
}

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

    @computed
    private get renderedContent() {
        if (!isEditorFormatter(this.formatter)) return;

        const { cache } = this.props;
        const cacheKey = this.formatter.cacheKey;
        const cachedValue = cache.get(cacheKey) as string | undefined;

        const renderingContent = cachedValue ||
            this.formatter.render(this.contentBuffer);
        if (!cachedValue) cache.set(cacheKey, renderingContent);

        return renderingContent;
    }

    private readonly editorOptions = {
        readOnly: true
    };

    render() {
        if (isEditorFormatter(this.formatter)) {
            try {
                return <portals.OutPortal<typeof ThemedSelfSizedEditor>
                    node={this.props.editorNode}
                    options={this.editorOptions}
                    language={this.formatter.language}
                    value={this.renderedContent!}
                    schema={this.props.schema}
                    expanded={this.props.expanded}
                />;
            } catch (e) {
                return <div>
                    Failed to render {this.props.contentType} content:<br/>
                    {e.toString()}
                </div>;
            }
        } else {
            const Viewer = this.formatter;
            return <Viewer
                expanded={this.props.expanded}
                content={this.contentBuffer}
                rawContentType={this.props.rawContentType}
            />;
        }
    }
}
