import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles'
import { FontAwesomeIcon } from '../../icons';

export const ClearArrayButton = styled(observer((props: {
    className?: string,
    count: number,
    onClear: () => void
}) => {
    return <button
        className={props.className}
        title='Clear all'
        tabIndex={props.count !== 0 ? 0 : -1}
        disabled={props.count === 0}
        onClick={props.onClear}
    >
        <FontAwesomeIcon icon={['far', 'trash-alt']} />
    </button>
}))`
    border: none;
    background-color: transparent;
    color: ${p => p.theme.mainColor};
    font-size: 20px;
    cursor: pointer;
    padding: 5px 10px;

    &:hover, &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }
`;