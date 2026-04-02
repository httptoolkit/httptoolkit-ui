import * as _ from 'lodash';
import { action, runInAction } from 'mobx';

import { CollectedEvent, HttpExchangeView, WebSocketStream } from '../../types';

import { copyToClipboard } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui/ui-store';
import { HttpExchange } from '../../model/http/http-exchange';
import {
    exportHar,
    generateCodeSnippet,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName,
    getCodeSnippetOptionFromKey,
    snippetExportOptions
} from '../../model/ui/export';
import { ContextMenuItem } from '../../model/ui/context-menu';
import { Filter, HostnameFilter } from '../../model/filters/search-filters';

export class ViewEventContextMenuBuilder {

    constructor(
        private accountStore: AccountStore,
        private uiStore: UiStore,

        private getSelectedEvents: () => ReadonlyArray<CollectedEvent>,
        private callbacks: {
            onPin: () => void,
            onDelete: (event: CollectedEvent) => void,
            onDeleteSelection: () => void,
            onBuildRuleFromExchange: (exchange: HttpExchangeView) => void,
            onBuildRuleFromSelectedExchanges: () => void,
            onPrepareToResendRequest: (exchange: HttpExchangeView) => void,
            onAddFilter: (filter: Filter) => void
        }
    ) {}

    getContextMenuCallback(event: CollectedEvent) {
        return (mouseEvent: React.MouseEvent) => {
            const { selectedEventIds } = this.uiStore;
            const isMultiSelected = selectedEventIds.size > 1 && selectedEventIds.has(event.id);

            if (isMultiSelected) {
                this.showMultiSelectionMenu(mouseEvent);
            } else if (event.isHttp()) {
                this.showHttpEventMenu(mouseEvent, event);
            } else {
                this.showBasicEventMenu(mouseEvent, event);
            }
        };
    }

    private showMultiSelectionMenu(mouseEvent: React.MouseEvent) {
        const isPaidUser = this.accountStore.user.isPaidUser();
        const selectedEvents = this.getSelectedEvents();
        const count = selectedEvents.length;
        const httpCount = selectedEvents.filter(e => e.isHttp() && !e.isWebSocket()).length;

        const menuOptions: Array<ContextMenuItem<void>> = [
            {
                type: 'option',
                label: 'Toggle Pinning',
                callback: () => this.callbacks.onPin()
            },
            ...(httpCount > 0 ? [{
                type: 'option' as const,
                enabled: isPaidUser,
                label: `Create ${httpCount} Matching Rule${httpCount !== 1 ? 's' : ''}`,
                callback: () => this.callbacks.onBuildRuleFromSelectedExchanges()
            }] : []),
            {
                type: 'option',
                label: `Delete ${count} Event${count !== 1 ? 's' : ''}`,
                callback: () => this.callbacks.onDeleteSelection()
            }
        ];

        this.uiStore.handleContextMenuEvent(
            mouseEvent,
            menuOptions,
            undefined as void
        );
    }

    private showHttpEventMenu(mouseEvent: React.MouseEvent, event: HttpExchange | WebSocketStream) {
        const isPaidUser = this.accountStore.user.isPaidUser();

        const preferredExportFormat = this.uiStore.exportSnippetFormat
            ? getCodeSnippetOptionFromKey(this.uiStore.exportSnippetFormat)
            : undefined;

        const menuOptions = [
            {
                type: 'option',
                label: 'Toggle Pinning',
                callback: action((data: HttpExchangeView) => { data.pinned = !data.pinned; })
            },
            {
                type: 'submenu',
                label: 'Filter traffic like this',
                items: [
                    {
                        type: 'option',
                        label: 'Show only this hostname',
                        callback: () => this.callbacks.onAddFilter(
                            new HostnameFilter(`hostname=${event.request.parsedUrl.hostname}`)
                        )
                    },
                    {
                        type: 'option',
                        label: 'Hide this hostname',
                        callback: () => this.callbacks.onAddFilter(
                            new HostnameFilter(`hostname!=${event.request.parsedUrl.hostname}`)
                        )
                    }
                ]
            },
            {
                type: 'option',
                label: 'Copy Request URL',
                callback: (data: HttpExchangeView) => copyToClipboard(data.request.url)
            },
            ...(!isPaidUser ? [
                { type: 'separator' },
                { type: 'option', label: 'With Pro:', enabled: false, callback: () => {} }
            ] as const : []),
            ...(this.callbacks.onPrepareToResendRequest ? [
                {
                    type: 'option',
                    enabled: isPaidUser,
                    label: 'Resend Request',
                    callback: (data: HttpExchangeView) => this.callbacks.onPrepareToResendRequest!(data)
                }
            ] as const : []),
            {
                type: 'option',
                enabled: isPaidUser,
                label: `Create Matching Modify Rule`,
                callback: this.callbacks.onBuildRuleFromExchange
            },
            {
                type: 'option',
                enabled: isPaidUser,
                label: `Export Exchange as HAR`,
                callback: exportHar
            },
            // If you have a preferred default format, we show that option at the top level:
            ...(preferredExportFormat && isPaidUser ? [{
                type: 'option',
                label: `Copy as ${getCodeSnippetFormatName(preferredExportFormat)} Snippet`,
                callback: async (data: HttpExchange) => {
                    copyToClipboard(
                        await generateCodeSnippet(data, preferredExportFormat, {
                            waitForBodyDecoding: true
                        })
                    );
                }
            }] as const : []),
            {
                type: 'submenu',
                enabled: isPaidUser,
                label: `Copy as Code Snippet`,
                items: Object.keys(snippetExportOptions).map((snippetGroupName) => ({
                    type: 'submenu' as const,
                    label: snippetGroupName,
                    items: snippetExportOptions[snippetGroupName].map((snippetOption) => ({
                        type: 'option' as const,
                        label: getCodeSnippetFormatName(snippetOption),
                        callback: async (data: HttpExchange) => {
                            // When you pick an option here, it updates your preferred default option
                            runInAction(() => {
                                this.uiStore.exportSnippetFormat = getCodeSnippetFormatKey(snippetOption);
                            });

                            copyToClipboard(
                                await generateCodeSnippet(data, snippetOption, {
                                    waitForBodyDecoding: true
                                })
                            );
                        }
                    }))
                }))
            },
            {
                type: 'option',
                label: 'Delete',
                callback: this.callbacks.onDelete
            }
        ];

        const sortedOptions = _.sortBy(menuOptions, (o: ContextMenuItem<unknown>) =>
            o.type === 'separator' || !(o.enabled ?? true)
        ) as Array<ContextMenuItem<HttpExchange | WebSocketStream>>;

        this.uiStore.handleContextMenuEvent(
            mouseEvent,
            sortedOptions,
            event
        )
    }

    private showBasicEventMenu(mouseEvent: React.MouseEvent, event: CollectedEvent) {
        this.uiStore.handleContextMenuEvent(mouseEvent, [
            {
                type: 'option',
                label: 'Toggle Pinning',
                callback: action((data: CollectedEvent) => { data.pinned = !data.pinned; })
            },
            {
                type: 'option',
                label: 'Delete',
                callback: this.callbacks.onDelete
            }
        ], event);
    }

}
