import * as React from 'react';
import { observer } from 'mobx-react';

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

export interface SendRequestHeadersProps extends CollapsibleCardProps {
    body: string;
    updateBody: (body: string) => void;
}

export const EditorContentSection = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }

    position: relative;
    flex-grow: 1;
    flex-shrink: 1;

    /*
    Allows shrinking smaller than content, to allow scrolling overflow e.g. for
    scrollable URL param content
    */
    min-height: 0;
`;

const SendBodyCardSection = styled(SendCardSection)`
    /* This is required to force the editor to shrink to fit, instead of going
       beyond the limits of the column when other item is expanded and pushes it down */
    overflow-y: hidden;

    ${p => !p.collapsed &&
        `flex-basis: 50%;` // Fixed size required to avoid editor resize thrashing
    }
`;

export const SendRequestBodyCard = observer((props: SendRequestHeadersProps) => {
    return <SendBodyCardSection
        {...props}
        headerAlignment='left'
    >
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Body
            </CollapsibleCardHeading>
        </header>
        <EditorContentSection>
            <ThemedContainerSizedEditor
                contentId='request'
                language={'text'}
                value={props.body}
                onChange={props.updateBody}
            />
        </EditorContentSection>
    </SendBodyCardSection>;
});