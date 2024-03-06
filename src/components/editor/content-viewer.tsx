import * as React from 'react';
import * as _ from 'lodash';
import { reaction, computed } from 'mobx';
import { observer } from 'mobx-react';
import { SchemaObject } from 'openapi3-ts';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { ObservablePromise, isObservablePromise } from '../../util/observable';
import { asError, unreachableCheck } from '../../util/error';
import { stringToBuffer } from '../../util/buffer';

import { ViewableContentType } from '../../model/events/content-types';
import { Formatters, isEditorFormatter } from '../../model/events/body-formatting';

import { ContainerSizedEditor, SelfSizedEditor } from './base-editor';
import { LoadingCardContent } from '../common/loading-card';
import { WarningIcon } from '../../icons';
import { ContentMonoValue } from '../common/text-content';

interface ContentViewerProps {
    children: Buffer | string;
    schema?: SchemaObject;
    expanded: boolean;
    rawContentType?: string;
    contentType: ViewableContentType;
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor | typeof ContainerSizedEditor>;
    cache: Map<Symbol, unknown>;

    // See BaseEditor.props.contentid
    contentId: string | null;

    // Called after content was successfully rendered into the editor. This may be immediate and uninteresting in
    // simple cases, or it may take longer if the content is large with a complex format (1MB of formatted JSON).
    onContentRendered?: () => void;
}

const ScrollableContentContainer = styled.div<{
    expanded: boolean
}>`
    overflow-y: auto;
    max-height: ${p => p.expanded
        ? '100%'
        : '560px' // Same as editor container
    }
`;

const CenteredContentViewerContainer = styled.div<{
    expanded: boolean
}>`
    display: flex;
    justify-content: center;

    ${p => p.expanded
        ? `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            align-items: stretch;
        `
        : `
            height: 100%;
            align-items: center;
        `
    }
`;

const RendererErrorContainer = styled.div`
    padding: 10px;

    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    background-color: ${p => p.theme.warningBackground};

    svg {
        margin-left: 0;
    }
`;

const RendererErrorMessage = styled(ContentMonoValue)`
    padding: 0;
    margin: 10px 0 0;
`;

const RendererError = (props: {
    error: Error,
    contentType: string
}) => <RendererErrorContainer>
    <p>
        <WarningIcon />
        Failed to render {props.contentType} content due to:
    </p>
    <RendererErrorMessage>
        { props.error.toString() }
    </RendererErrorMessage>
</RendererErrorContainer>

@observer
export class ContentViewer extends React.Component<ContentViewerProps> {

    constructor(props: ContentViewerProps) {
        super(props);

        // Every time the rendered content changes, as long as it's not a 'loading' promise,
        // we fire a callback to notify that the content has been rendered.
        reaction(() => {
            try {
                return this.renderedContent;
            } catch (e) {}
        }, (newValue) => {
            if (newValue && !isObservablePromise(newValue)) {
                requestAnimationFrame(() => {
                    this.props.onContentRendered?.();
                });
            }
        }, { fireImmediately: true });
    }

    @computed
    private get formatter() {
        return Formatters[this.props.contentType] || Formatters.text!;
    }

    @computed
    private get contentBuffer() {
        return _.isString(this.props.children)
            ? stringToBuffer(this.props.children)
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
                    return <portals.OutPortal<typeof SelfSizedEditor>
                        contentId={this.props.contentId}
                        node={this.props.editorNode}
                        options={this.editorOptions}
                        language={this.formatter.language}
                        value={content!}
                        schema={this.props.schema}
                        expanded={this.props.expanded}
                    />;
                }
            } catch (e) {
                return <RendererError
                    contentType={this.props.contentType}
                    error={asError(e)}
                />;
            }
        } else {
            const formatterConfig = this.formatter;

            // Formatter components should all be either scrollable (top aligned, extending
            // downwards, scrolling if there's no space) or centered (in the middle, scaling
            // down to match if the container is ever smaller than the content size):
            const FormatterContainer = formatterConfig.layout === 'scrollable'
                    ? ScrollableContentContainer
                : formatterConfig.layout === 'centered'
                    ? CenteredContentViewerContainer
                : unreachableCheck(formatterConfig.layout);

            return <FormatterContainer expanded={this.props.expanded}>
                <formatterConfig.Component
                    content={this.contentBuffer}
                    rawContentType={this.props.rawContentType}
                />
            </FormatterContainer>;
        }
    }
}
