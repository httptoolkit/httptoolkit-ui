import * as _ from 'lodash';
import * as React from 'react';

export function filterProps<C extends React.ComponentType<any>>(
    Component: C,
    ...keys: string[]
): C {
    return ((props: any) => <Component {..._.omit(props, keys) as any} />) as C;
}

// Trigger the click handler when Enter is pressed on this element
export function clickOnEnter<T extends Element>(e: React.KeyboardEvent<T>) {
    if (e.target === e.currentTarget && e.key === 'Enter') {
        // Can't use .click(), as sometimes our target is an SVGElement, and they don't have it
        e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
}

export const noPropagation = <E extends React.BaseSyntheticEvent>(
    callback: (event: E) => void
) => (event: E) => {
    event.stopPropagation();
    callback(event);
}

export const inputValidation = (
    checkFn: (input: string) => boolean,
    errorMessage: string
) => (input: HTMLInputElement) => {
    const inputValue = input.value;
    if (!inputValue || checkFn(inputValue)) {
        input.setCustomValidity('');
    } else {
        input.setCustomValidity(errorMessage);
    }
    input.reportValidity();
    return input.validity.valid;
}