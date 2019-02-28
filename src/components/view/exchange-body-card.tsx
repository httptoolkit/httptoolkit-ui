import * as _ from 'lodash';
import * as React from 'react';
import { IObservableValue, observable, autorun, action } from 'mobx';
import { disposeOnUnmount, observer, inject } from 'mobx-react';
import { SchemaObject } from 'openapi-directory';

import { HtkRequest, HtkResponse } from '../../types';
import { styled, Theme } from '../../styles';
import { HtkContentType, getCompatibleTypes } from '../../content-types';
import { decodeContent } from '../../workers/worker-api';

import { ExchangeCard, LoadingExchangeCard } from './exchange-card';
import { Pill, PillSelector } from '../common/pill';
import { CopyButton } from '../common/copy-button';
import { ContentEditor, getContentEditorName } from '../editor/content-editor';

function getReadableSize(bytes: number, siUnits = true) {
    let thresh = siUnits ? 1000 : 1024;

    let units = siUnits
        ? ['bytes', 'kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['bytes', 'KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

    let unitIndex = bytes === 0 ? 0 :
        Math.floor(Math.log(bytes) / Math.log(thresh));

    let unitName = bytes === 1 ? 'byte' : units[unitIndex];

    return (bytes / Math.pow(thresh, unitIndex)).toFixed(1).replace(/\.0$/, '') + ' ' + unitName;
}

const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.popBackground};

    .monaco-editor-overlaymessage {
        display: none;
    }
`;

const CopyBody = styled(CopyButton)`
    padding: 5px 10px;
    margin-right: auto;
    color: ${p => p.theme.mainColor};
`;

type ExchangeMessage = HtkRequest | HtkResponse;

@inject('theme')
@observer
export class ExchangeBodyCard extends React.Component<{
    title: string,
    message: ExchangeMessage,
    apiBodySchema?: SchemaObject,
    direction: 'left' | 'right',
    collapsed: boolean,
    onCollapseToggled: () => void,
    theme?: Theme
}> {

    @observable
    private selectedContentType: HtkContentType | undefined;

    /*
     * Bit of a hack... We pass an observable down into the child editor component, who
     * writes to it when they've got rendered content (or not), which automatically
     * updates the copy button's rendered content.
     */
    private currentContent = observable.box<string | undefined>();

    private static decodedBodyCache = new WeakMap<
        ExchangeMessage, IObservableValue<undefined | Buffer>
    >();

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            const message = this.props.message;

            if (!message) {
                this.setContentType(undefined);
                return;
            }

            if (ExchangeBodyCard.decodedBodyCache.get(message) === undefined) {
                const observableResult = observable.box<undefined | Buffer>(undefined);
                ExchangeBodyCard.decodedBodyCache.set(message, observableResult);

                decodeContent(message.body.buffer, message.headers['content-encoding'])
                .then(action<(result: Buffer) => void>((decodingResult) => {
                    observableResult.set(decodingResult);

                    // Necessary as a read for this key before the observable was
                    // created will not be subscribed to this update.
                    if (this.props.message === message) {
                        this.forceUpdate();
                    }
                }))
                // Ignore errors for now - for broken encodings just spin forever
                .catch(() => {});
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
            theme
        } = this.props;

        const compatibleContentTypes = getCompatibleTypes(message.contentType, message.headers['content-type']);
        const contentType = _.includes(compatibleContentTypes, this.selectedContentType) ?
            this.selectedContentType! : message.contentType;

        const decodedBodyCache = ExchangeBodyCard.decodedBodyCache.get(message);
        const decodedBody = decodedBodyCache ? decodedBodyCache.get() : undefined;

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
                        monacoTheme={theme!.monacoTheme}
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