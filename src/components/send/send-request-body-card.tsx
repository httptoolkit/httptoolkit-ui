import * as React from 'react';
import { observer } from 'mobx-react';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { EditorCardContent } from '../view/http/http-body-card';

export interface SendRequestHeadersProps extends CollapsibleCardProps {
    body: string;
    updateBody: (body: string) => void;
}

export const SendRequestBodyCard = observer((props: SendRequestHeadersProps) => {
    return <CollapsibleCard {...props}>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Body
            </CollapsibleCardHeading>
        </header>
        <EditorCardContent>
            <ThemedSelfSizedEditor
                contentId='request'
                language={'text'}
                value={props.body}
                onChange={props.updateBody}
            />
        </EditorCardContent>
    </CollapsibleCard>;
});