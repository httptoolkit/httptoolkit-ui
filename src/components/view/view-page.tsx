import * as React from 'react';
import * as _ from 'lodash';
import { autorun, action, observable, runInAction } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { WithInjected } from '../../types';
import { styled } from '../../styles';

import { ActivatedStore } from '../../model/interception-store';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';

import { ViewEventList, CollectedEvent } from './view-event-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { TlsFailureDetailsPane } from './tls-failure-details-pane';
import { ContentEditor } from '../editor/content-editor';

interface ViewPageProps {
    className?: string,
    interceptionStore: ActivatedStore
}

@inject('interceptionStore')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    @observable.ref selectedEvent: CollectedEvent | undefined = undefined;

    requestEditor = portals.createPortalNode<ContentEditor>();
    responseEditor = portals.createPortalNode<ContentEditor>();

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (!_.includes(this.props.interceptionStore.events, this.selectedEvent)) {
                runInAction(() => this.selectedEvent = undefined);
            }
        }));
    }

    render(): JSX.Element {
        const {
            events,
            clearInterceptedData,
            isPaused,
            certPath
        } = this.props.interceptionStore;

        let rightPane: JSX.Element;
        if (!this.selectedEvent) {
            rightPane = <EmptyState icon={['fas', 'arrow-left']}>
                Select an exchange to see the full details.
            </EmptyState>;
        } else if ('request' in this.selectedEvent) {
            rightPane = <ExchangeDetailsPane
                exchange={this.selectedEvent}
                requestEditor={this.requestEditor}
                responseEditor={this.responseEditor}
            />;
        } else {
            rightPane = <TlsFailureDetailsPane failure={this.selectedEvent} certPath={certPath} />;
        }

        return <div className={this.props.className}>
            <SplitPane
                split='vertical'
                primary='second'
                defaultSize='50%'
                minSize={300}
                maxSize={-300}
            >
                <ViewEventList
                    onSelected={this.onSelected}
                    onClear={clearInterceptedData}
                    events={events}
                    isPaused={isPaused}
                />
                { rightPane }
            </SplitPane>

            {[this.requestEditor, this.responseEditor].map((editorNode, i) =>
                <portals.InPortal key={i} node={editorNode}>
                    <ContentEditor
                        contentType='text'
                        rawContentType=''
                        children=''
                    />
                </portals.InPortal>
            )}
        </div>;
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.selectedEvent = event;
    }
}

const StyledViewPage = styled(
    // Exclude store from the external props, as it's injected
    ViewPage as unknown as WithInjected<typeof ViewPage, 'interceptionStore'>
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };