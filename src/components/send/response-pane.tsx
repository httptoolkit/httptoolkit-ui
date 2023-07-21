import * as React from "react";
import { observer } from "mobx-react";

import { styled } from '../../styles';

const ResponsePaneContainer = styled.section`
`;

@observer
export class ResponsePane extends React.Component<{}> {

    render() {
        return <ResponsePaneContainer>

        </ResponsePaneContainer>;
    }

}