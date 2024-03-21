import * as React from 'react';
import { observer } from 'mobx-react';

import { TimingEvents } from '../../types';
import { observableClock } from '../../util/observable';

import { Pill } from './pill';

function sigFig(num: number, figs: number): number {
    return parseFloat(num.toFixed(figs));
}

type DurationPillProps = { className?: string } & (
    | { durationMs: number }
    | { timingEvents: Partial<TimingEvents> }
);

const calculateDuration = (timingEvents: Partial<TimingEvents>) => {
    const doneTimestamp = timingEvents.responseSentTimestamp ?? timingEvents.abortedTimestamp;

    if (timingEvents.startTimestamp !== undefined && doneTimestamp !== undefined) {
        return doneTimestamp - timingEvents.startTimestamp;
    }

    if (timingEvents.startTime !== undefined) {
        // This may not be perfect - note that startTime comes from the server so we might be
        // mildly out of sync (ehhhh, in theory) but this is only for pending requests where
        // that's unlikely to be an issue - the final time will be correct regardless.
        return observableClock.getTime() - timingEvents.startTime;
    }
}

export const DurationPill = observer((p: DurationPillProps) => {
    let duration: number | undefined;

    if ('durationMs' in p) {
        duration = p.durationMs;
    } else if (p.timingEvents) {
        duration = calculateDuration(p.timingEvents);
    }

    if (duration === undefined) return null;

    return <Pill className={p.className}>{
        duration < 100 ? sigFig(duration, 2) + 'ms' : // 22.34ms
        duration < 1000 ? sigFig(duration, 1) + 'ms' : // 999.5ms
        duration < 10000 ? sigFig(duration / 1000, 3) + ' seconds' : // 3.045 seconds
        sigFig(duration / 1000, 1) + ' seconds' // 11.2 seconds
    }</Pill>;
});