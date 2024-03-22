import * as React from 'react';
import { observer } from 'mobx-react';

import { TimingEvents } from '../../types';
import { observableClock } from '../../util/observable';

import { Pill } from './pill';

function sigFig(num: number, figs: number): string {
    return num.toFixed(figs);
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
        duration < 100 ? sigFig(duration, 1) + 'ms' : // 22.3ms
        duration < 1000 ? sigFig(duration, 0) + 'ms' : // 999ms
        duration < 5000 ? sigFig(duration / 1000, 2) + ' seconds' : // 3.04 seconds
        duration < 9900 ? sigFig(duration / 1000, 1) + ' seconds' : // 8.2 seconds
        sigFig(duration / 1000, 0) + ' seconds' // 30 seconds
    }</Pill>;
});