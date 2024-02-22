import { action, runInAction } from 'mobx';

import { CollectedEvent } from '../../types';

import { copyToClipboard } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui/ui-store';
import { HttpExchange } from '../../model/http/exchange';
import {
    exportHar,
    generateCodeSnippet,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName,
    getCodeSnippetOptionFromKey,
    snippetExportOptions
} from '../../model/ui/export';

export class ViewEventContextMenuBuilder {

    constructor(
        private accountStore: AccountStore,
        private uiStore: UiStore,

        private onPin: (event: CollectedEvent) => void,
        private onDelete: (event: CollectedEvent) => void,
        private onBuildRuleFromExchange: (exchange: HttpExchange) => void,
        private onPrepareToResendRequest?: (exchange: HttpExchange) => void
    ) {}

    private readonly BaseOptions = {
        Pin: {
            type: 'option',
            label: 'Toggle Pinning',
            callback: this.onPin
        },
        Delete: {
            type: 'option',
            label: 'Delete',
            callback: this.onDelete
        }
    } as const;

    getContextMenuCallback(event: CollectedEvent) {
        return (mouseEvent: React.MouseEvent) => {
            const { isPaidUser } = this.accountStore;

            const preferredExportFormat = this.uiStore.exportSnippetFormat
                ? getCodeSnippetOptionFromKey(this.uiStore.exportSnippetFormat)
                : undefined;

            if (event.isHttp()) {
                this.uiStore.handleContextMenuEvent(mouseEvent, [
                    this.BaseOptions.Pin,
                    {
                        type: 'option',
                        label: 'Copy Request URL',
                        callback: (data: HttpExchange) => copyToClipboard(data.request.url)
                    },
                    ...(this.onPrepareToResendRequest ? [
                        {
                            type: 'option',
                            label: 'Resend Request',
                            callback: (data: HttpExchange) => this.onPrepareToResendRequest!(data)
                        }
                    ] as const : []),
                    this.BaseOptions.Delete,
                    ...(!isPaidUser ? [
                        { type: 'separator' },
                        { type: 'option', label: 'With Pro:', enabled: false, callback: () => {} }
                    ] as const : []),
                    {
                        type: 'option',
                        enabled: isPaidUser,
                        label: `Create Matching Mock Rule`,
                        callback: this.onBuildRuleFromExchange
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
                            type: 'submenu',
                            label: snippetGroupName,
                            items: snippetExportOptions[snippetGroupName].map((snippetOption) => ({
                                type: 'option',
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
                ], event)
            } else {
                // For non-HTTP events, we just show the super-basic globally supported options:
                this.uiStore.handleContextMenuEvent(mouseEvent, [
                    this.BaseOptions.Pin,
                    this.BaseOptions.Delete
                ], event);
            }
        };
    }

}