import * as React from 'react';
import { observer, inject } from 'mobx-react';
import * as dateFns from 'date-fns';

import { styled } from '../../styles'
import { Icon, IconProp } from '../../icons';
import { saveFile, uploadFile } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/http/events-store';
import { HttpExchange } from '../../model/http/exchange';
import { generateHar } from '../../model/http/har';

const IconButton = styled((p: {
    className?: string,
    title: string,
    icon: IconProp,
    disabled?: boolean,
    onClick: () => void
}) =>
    <button
        className={p.className}
        title={p.title}
        tabIndex={p.disabled ? -1 : 0}
        disabled={p.disabled}
        onClick={p.onClick}
    >
        <Icon icon={p.icon} />
    </button>
)`
    border: none;
    background-color: transparent;
    color: ${p => p.theme.mainColor};
    font-size: 20px;
    padding: 5px 10px;

    &:disabled {
        opacity: 0.5;
    }

    &:not([disabled]) {
        cursor: pointer;

        &:hover, &:focus {
            outline: none;
            color: ${p => p.theme.popColor};
        }
    }
`;

export const ClearAllButton = observer((props: {
    className?: string,
    disabled: boolean,
    onClear: () => void
}) => {
    return <IconButton
        icon={['far', 'trash-alt']}
        title='Clear all'
        disabled={props.disabled}
        onClick={props.onClear}
    />
});

export const ExportAsHarButton = inject('accountStore')(observer((props: {
    className?: string,
    accountStore?: AccountStore,
    exchanges: HttpExchange[]
}) => {
    const { isPaidUser } = props.accountStore!;

    return <IconButton
        icon={['fas', 'download']}
        title={
            isPaidUser
                ? 'Export these requests & responses as a HAR file'
                : (
                    'With Pro: Export requests & responses as a HAR file, ' +
                    'to save for later or share with others'
                )
        }
        disabled={!isPaidUser || props.exchanges.length === 0}
        onClick={async () => {
            const harContent = JSON.stringify(
                await generateHar(props.exchanges)
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
            icon={['fas', 'upload']}
            title={
                isPaidUser
                    ? 'Import exchanges from a HAR file'
                    : (
                        'With Pro: Imports requests & responses from HAR files, ' +
                        'to examine past recordings or data from other tools'
                    )
            }
            disabled={!isPaidUser}
            onClick={async () => {
                const uploadedFile = await uploadFile('text', ['.har', 'application/har', 'application/har+json']);
                if (uploadedFile) props.eventsStore!.loadFromHar(JSON.parse(uploadedFile));
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
            title={`${isPaused ? 'Resume' : 'Pause'} collecting intercepted messages`}
            onClick={togglePause}
        />
    })
);