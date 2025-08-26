import * as React from 'react';
import { observer } from 'mobx-react';

import { Pill } from './pill';

import { calculateAndFormatDuration, FormattedDurationProps } from "../../util/utils";

type DurationPillProps = { className?: string } & FormattedDurationProps;

export const DurationPill = observer((p: DurationPillProps) => {
    return <Pill className={p.className}>{calculateAndFormatDuration(p)}</Pill>;
});