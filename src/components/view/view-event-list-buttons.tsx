import * as React from 'react';
import { observer, inject } from 'mobx-react';
import * as dateFns from 'date-fns';
import * as dedent from 'dedent';
import * as Ajv from 'ajv';

import { ViewableEvent } from '../../types';
import { saveFile, uploadFile, Ctrl } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';
import { generateHar } from '../../model/http/har';
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
    const { isPaidUser } = props.accountStore!;

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

export const ImportHarButton = inject('eventsStore', 'accountStore')(
    observer((props: {
        accountStore?: AccountStore,
        eventsStore?: EventsStore
    }) => {
        const { isPaidUser } = props.accountStore!;

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