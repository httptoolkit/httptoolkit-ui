import * as React from 'react';

import {
    Formatters,
    isEditorFormatter,
    EditorFormatter
} from '../../model/events/body-formatting';
import { getContentEditorName } from '../../model/events/content-types';

import { IconButton } from './icon-button';

export const FormatButton = (props: {
    className?: string,
    format: keyof typeof Formatters,
    content: Buffer,
    onFormatted: (content: string) => void
}) => {
    const { format, content, onFormatted } = props;

    const formatter = Formatters[format];
    const canFormat = !!formatter &&
        isEditorFormatter(formatter) &&
        formatter.isEditApplicable;

    return <IconButton
        className={props.className}
        title={canFormat
            ? `Format as ${getContentEditorName(props.format)}`
            : ""
        }
        disabled={!canFormat}
        icon={['fas', 'align-left']}
        onClick={async () => {
            // This is often async, and in that case it'll have a race condition: if you
            // format content and then keep editing, when its formatted you lose your edits.
            // That gap should be very short though, and arguably this is expected,
            // so we ignore it.
            onFormatted(
                await (formatter as EditorFormatter).render(content)
            );
        }}
    />;
}
