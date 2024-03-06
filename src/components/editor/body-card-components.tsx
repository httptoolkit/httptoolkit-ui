import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { Headers, RawHeaders } from '../../types';
import { styled } from '../../styles';
import { WarningIcon } from '../../icons';

import { asHeaderArray, getHeaderValue, getHeaderValues } from '../../util/headers';
import { saveFile } from '../../util/ui';
import { ErrorLike } from '../../util/error';

import {
    EditableContentType,
    ViewableContentType,
    getContentEditorName
} from '../../model/events/content-types';
import { getReadableSize } from '../../util/buffer';
import { EditableBody } from '../../model/http/editable-body';

import { CollapsibleCardHeading, ExpandState } from '../common/card';
import { CollapsingButtons } from '../common/collapsing-buttons';
import { Pill, PillSelector } from '../common/pill';
import { ExpandShrinkButton } from '../common/expand-shrink-button';
import { IconButton } from '../common/icon-button';
import { CardErrorBanner } from '../common/card-error-banner';
import { ContentMonoValue } from '../common/text-content';
import { FormatButton } from '../common/format-button';

// This contains all the components of a card that shows a body viewer (typically for
// HTTP, but not always) but exported individually so they can be recombined & tweaked
// in slightly different ways in each case.

export const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }

    position: relative;
    flex-grow: 1;

    /*
    Allows shrinking smaller than content, to allow scrolling overflow e.g. for
    scrollable URL param content
    */
    min-height: 0;
`;

export const ContainerSizedEditorCardContent = styled(EditorCardContent)`
    flex-shrink: 1;
`;

export function getBodyDownloadFilename(url: string, headers: Headers | RawHeaders): string | undefined {
    const contentDisposition = getHeaderValue(headers, 'content-disposition') || "";
    const filenameMatch = / filename="([^"]+)"/.exec(contentDisposition);

    if (filenameMatch) {
        const suggestedFilename = filenameMatch[1];
        return _.last(_.last(suggestedFilename.split('/') as string[])!.split('\\')); // Strip any path info
    }

    const urlBaseName = _.last(url.split('/'));
    if (urlBaseName?.includes(".")) return urlBaseName;
}

export const ReadonlyBodyCardHeader = (props: {
    body: Buffer | undefined,
    mimeType?: string,
    downloadFilename?: string,

    title: string,
    expanded: ExpandState,
    onExpandToggled: () => void,
    onCollapseToggled?: () => void,

    selectedContentType: ViewableContentType,
    contentTypeOptions: readonly ViewableContentType[],
    onChangeContentType: (contentType: ViewableContentType) => void,

    isPaidUser: boolean
}) => {
    const { body } = props;

    return <>
        <CollapsingButtons>
            <ExpandShrinkButton
                expanded={props.expanded}
                onClick={props.onExpandToggled}
            />
            <IconButton
                icon={['fas', 'download']}
                title={
                    props.isPaidUser
                        ? "Save this body as a file"
                        : "With Pro: Save this body as a file"
                }
                disabled={!props.isPaidUser || !body}
                onClick={() => saveFile(
                    props.downloadFilename || "",
                    props.mimeType || 'application/octet-stream',
                    body! // Checked in disabled state above
                )}
            />
        </CollapsingButtons>
        { body && // May be undefined during decoding
            <Pill>{ getReadableSize(body.byteLength) }</Pill>
        }
        <PillSelector<ViewableContentType>
            onChange={props.onChangeContentType}
            value={props.selectedContentType}
            options={props.contentTypeOptions}
            nameFormatter={getContentEditorName}
        />
        <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
            { props.title }
        </CollapsibleCardHeading>
    </>;
};

export const EditableBodyCardHeader = observer((props: {
    body: EditableBody,
    onBodyFormatted: (bodyString: string) => void,

    title: string,
    expanded: ExpandState,
    onExpandToggled: () => void,
    onCollapseToggled?: () => void,

    selectedContentType: EditableContentType,
    contentTypeOptions: readonly EditableContentType[],
    onChangeContentType: (contentType: EditableContentType) => void
}) => {
    const { body } = props;

    return <>
        <CollapsingButtons>
            <ExpandShrinkButton
                expanded={props.expanded}
                onClick={props.onExpandToggled}
            />
            <FormatButton
                format={props.selectedContentType}
                content={body.decoded}
                onFormatted={props.onBodyFormatted}
            />
        </CollapsingButtons>

        <Pill>{ getReadableSize(body.decoded) }</Pill>

        <PillSelector<EditableContentType>
            onChange={props.onChangeContentType}
            value={props.selectedContentType}
            options={props.contentTypeOptions}
            nameFormatter={getContentEditorName}
        />

        <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
            { props.title }
        </CollapsibleCardHeading>
    </>;
});

const EncodingErrorMessage = styled(ContentMonoValue)`
    padding: 0;
    margin: 10px 0;
`;

export const BodyCodingErrorBanner = (props: {
    type: 'encoding' | 'decoding'
    direction?: 'left' | 'right',
    error: ErrorLike,
    headers: Headers | RawHeaders
}) => <CardErrorBanner direction={props.direction}>
    <p>
        <WarningIcon/> Body { props.type } failed for encoding '{
            asHeaderArray(getHeaderValues(props.headers, 'content-encoding'))
        }' due to:
    </p>
    <EncodingErrorMessage>
        { props.error.code
            ? `${props.error.code}: `
            : ''
        }{ props.error.message || props.error.toString() }
    </EncodingErrorMessage>
    <p>
        This typically means the <code>content-encoding</code> header is incorrect or
        unsupported{
            props.type === 'decoding'
            ? ', or the body was corrupted'
            : '' // Can't really happen when encoding user input.
        }. The raw content {
            props.type === 'decoding'
            ? '(not decoded) is shown below'
            : '(not encoded) will be used as-is'
        }.
    </p>
</CardErrorBanner>;