import { TimingEvents } from "../types";
import { observableClock } from "./observable";

export type FormattedDurationProps =
    {
        durationMs?: number,
        timingEvents: Partial<TimingEvents>
    };

export const calculateDuration = (timingEvents: Partial<TimingEvents>): number | undefined => {
    const doneTimestamp = timingEvents.responseSentTimestamp ?? timingEvents.abortedTimestamp ?? timingEvents.wsClosedTimestamp;

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

export const calculateAndFormatDuration = (props: FormattedDurationProps): string | null | undefined => {
    let duration: number | undefined;

    if (props.durationMs !== undefined) {
        duration = props.durationMs;
    } else if (props.timingEvents) {
        duration = calculateDuration(props.timingEvents);
    }

    if (duration === undefined)
        return null;

    return (
        duration < 100 ? sigFig(duration, 1) + 'ms' : // 22.3ms
            duration < 1000 ? sigFig(duration, 0) + 'ms' : // 999ms
                duration < 5000 ? sigFig(duration / 1000, 2) + 's' : // 3.04s
                    duration < 59000 ? sigFig(duration / 1000, 1) + 's' : // 30.2s
                        sigFig(duration / 60000, 1) + 'm' // 1.1m
    );
};

function sigFig(num: number, figs: number): string {
    return num.toFixed(figs);
}