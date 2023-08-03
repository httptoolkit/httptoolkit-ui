import * as React from 'react';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';

import {
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import {
    SendCardSection
} from './send-card-section';
import {
    ThemedContainerSizedEditor
} from '../editor/base-editor';
import { EditorCardContent } from '../editor/body-card-components';

export interface SendRequestBodyProps extends CollapsibleCardProps {
    body: string;
    updateBody: (body: string) => void;
    editorNode: portals.HtmlPortalNode<typeof ThemedContainerSizedEditor>;
}

export const SendRequestEditorContent = styled(EditorCardContent)`
    flex-shrink: 1;
`;

const SendBodyCardSection = styled(SendCardSection)`
    /* This is required to force the editor to shrink to fit, instead of going
       beyond the limits of the column when other item is expanded and pushes it down */
    overflow-y: hidden;

    ${p => !p.collapsed && `
        /* When we're open, we want space more than any siblings */
        flex-grow: 9999999;

        /* If we're open, never let us get squeezed to nothing: */
        min-height: 25vh;

        /* Fixed size required to avoid editor resize thrashing */
        flex-basis: 50%;
    `
    }
`;

export const SendRequestBodyCard = observer((props: SendRequestBodyProps) => {
    return <SendBodyCardSection
        {...props}
        headerAlignment='left'
    >
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Body
            </CollapsibleCardHeading>
        </header>
        <SendRequestEditorContent>
            <portals.OutPortal<typeof ThemedContainerSizedEditor>
                node={props.editorNode}

                contentId='request'
                language={'text'}
                value={props.body}
                onChange={props.updateBody}
            />
        </SendRequestEditorContent>
    </SendBodyCardSection>;
});