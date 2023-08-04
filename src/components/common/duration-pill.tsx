import * as React from 'react';
import { observer } from 'mobx-react';
import { TimingEvents } from '../../types';

import { Pill } from './pill';

function sigFig(num: number, figs: number): number {
    return parseFloat(num.toFixed(figs));
}

type DurationPillProps = { className?: string } & (
    | { durationMs: number }
    | { timingEvents: Partial<TimingEvents> }
)

export const DurationPill = observer((p: DurationPillProps) => {
    let duration: number | undefined;

    if ('durationMs' in p) {
        duration = p.durationMs;
    } else {
        const timingEvents = p.timingEvents;
        const doneTimestamp = timingEvents.responseSentTimestamp ?? timingEvents.abortedTimestamp;

        duration = doneTimestamp !== undefined && timingEvents.startTimestamp !== undefined
            ? doneTimestamp - timingEvents.startTimestamp
            : undefined;
    }

    if (duration === undefined) return null;

    return <Pill className={p.className}>{
        duration < 100 ? sigFig(duration, 2) + 'ms' : // 22.34ms
        duration < 1000 ? sigFig(duration, 1) + 'ms' : // 999.5ms
        duration < 10000 ? sigFig(duration / 1000, 3) + ' seconds' : // 3.045 seconds
        sigFig(duration / 1000, 1) + ' seconds' // 11.2 seconds
    }</Pill>;
});