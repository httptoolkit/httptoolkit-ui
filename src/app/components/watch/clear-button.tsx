import * as React from 'react';
import { observer } from 'mobx-react';

import { styled, FontAwesomeIcon } from '../../styles'

export const ClearArrayButton = styled(observer((props: {
    className?: string,
    array: any[],
    onClear: () => void
}) => {
    return <button
        className={props.className}
        title='Clear all'
        disabled={props.array.length === 0}
        onClick={props.onClear}
    >
        <FontAwesomeIcon icon={['far', 'trash-alt']} />
    </button>
}))`
    border: none;
    background-color: transparent;
    font-size: 20px;
    cursor: pointer;
    padding: 5px 10px;

    &:hover {
        color: ${p => p.theme.popColor};
    }
`;