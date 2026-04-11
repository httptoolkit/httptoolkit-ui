import * as React from 'react';
import { inject } from 'mobx-react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import * as dateFns from 'date-fns';
import * as dedent from 'dedent';
import * as Ajv from 'ajv';

import { ViewableEvent } from '../../types';
import { saveFile, uploadFile, Ctrl } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';
import { UiStore } from '../../model/ui/ui-store';
import { generateHar } from '../../model/http/har';
import { buildZipMetadata } from '../../model/ui/zip-metadata';
import { resolveFormats } from '../../model/ui/snippet-formats';
import { generateZipInWorker } from '../../services/ui-worker-api';
import { downloadBlob } from '../../util/download';
import { buildZipArchiveName } from '../../util/export-filenames';
import { logError } from '../../errors';
import { formatAjvError } from '../../util/json-schema';

import { IconButton } from '../common/icon-button';

export const ClearAllButton = observer((props: {
    className?: string,
    disabled: boolean,
    onClear: () => void
}) => <IconButton
    icon={['far', 'trash-alt']}
    title={`Clear all (${Ctrl}+Shift+Delete)`}
    disabled={props.disabled}
    onClick={props.onClear}
/>);

export const ExportAsHarButton = inject('accountStore')(observer((props: {
    className?: string,
    accountStore?: AccountStore,
    events: ReadonlyArray<ViewableEvent>
}) => {
    const isPaidUser = props.accountStore!.user.isPaidUser();

    return <IconButton
        icon={['fas', 'save']}
        title={
            isPaidUser
                ? 'Export these exchanges as a HAR file'
                : (
                    'With Pro: Export requests & responses as a HAR file, ' +
                    'to save for later or share with others'
                )
        }
        disabled={!isPaidUser || props.events.length === 0}
        onClick={async () => {
            const harContent = JSON.stringify(
                await generateHar(props.events)
            );
            const filename = `HTTPToolkit_${
                dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
            }.har`;

            saveFile(filename, 'application/har+json;charset=utf-8', harContent);
        }}
    />
}));

export const ExportAsZipButton = inject('accountStore', 'uiStore')(observer((props: {
    className?: string,
    accountStore?: AccountStore,
    uiStore?: UiStore,
    events: ReadonlyArray<ViewableEvent>
}) => {
    const isPaidUser = props.accountStore!.user.isPaidUser();
    const [isExporting, setIsExporting] = React.useState(false);

    // Guard against setState on unmounted component
    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    return <IconButton
        icon={['fas', 'download']}
        title={
            isPaidUser
                ? 'Export these exchanges as a ZIP with all code snippets'
                : (
                    'With Pro: Export requests & responses as a ZIP file ' +
                    'containing code snippets in all formats'
                )
        }
        disabled={!isPaidUser || props.events.length === 0 || isExporting}
        onClick={async () => {
            setIsExporting(true);
            try {
                // Snapshot to avoid mid-export changes
                const events = props.events.slice();
                if (events.length === 0) return;

                const har = await generateHar(events);
                const harEntries = toJS(har.log.entries);
                const formats = resolveFormats(props.uiStore!.zipFormatIds);
                const metadata = buildZipMetadata(events.length, formats);

                const result = await generateZipInWorker(harEntries, formats, metadata);
                if (!mountedRef.current) return;

                const blob = new Blob([result.buffer], { type: 'application/zip' });
                downloadBlob(blob, buildZipArchiveName(events.length));
            } catch (err) {
                logError(err);
            } finally {
                if (mountedRef.current) setIsExporting(false);
            }
        }}
    />
}));

export const ImportHarButton = inject('eventsStore', 'accountStore')(
    observer((props: {
        accountStore?: AccountStore,
        eventsStore?: EventsStore
    }) => {
        const isPaidUser = props.accountStore!.user.isPaidUser();

        return <IconButton
            icon={['fas', 'folder-open']}
            title={
                isPaidUser
                    ? 'Import exchanges from a HAR file'
                    : (
                        'With Pro: Import requests & responses from HAR files, ' +
                        'to examine past recordings or data from other tools'
                    )
            }
            disabled={!isPaidUser}
            onClick={async () => {
                const uploadedFile = await uploadFile('text', ['.har', 'application/har', 'application/har+json']);
                if (uploadedFile) {
                    let data: {};
                    try {
                        data = JSON.parse(uploadedFile);
                        await props.eventsStore!.loadFromHar(data);
                    } catch (error: any) {
                        logError(error);

                        if (error.name === 'HARError' && error.errors) {
                            alert(dedent`
                                HAR file is not valid.

                                ${
                                    error.errors
                                    .map((e: Ajv.ErrorObject) => formatAjvError(data, e))
                                    .join('\n')
                                }
                            `);
                        } else {
                            alert(dedent`
                                Could not parse HAR file.

                                ${error.message || error}
                            `);
                        }
                    }
                }
            }}
        />
    })
);

export const PlayPauseButton = inject('eventsStore')(
    observer((props: {
        eventsStore?: EventsStore
    }) => {
        const { isPaused, togglePause } = props.eventsStore!;

        return <IconButton
            icon={['fas', isPaused ? 'play' : 'pause']}
            title={`${isPaused ? 'Resume' : 'Pause'} collecting intercepted exchanges`}
            onClick={togglePause}
        />
    })
);

export const ScrollToEndButton = (props: { onScrollToEnd: () => void }) =>
    <IconButton
        icon={['fas', 'level-down-alt']}
        title="Scroll to the bottom of the list"
        onClick={props.onScrollToEnd}
    />