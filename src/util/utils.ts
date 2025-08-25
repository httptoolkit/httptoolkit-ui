import { TimingEvents } from "../types";
import { observableClock } from "./observable";
import {formatDuration} from "./text";

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

    return formatDuration(duration);
};