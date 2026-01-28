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

/**
 * An input validation function combines check logic with an explanatory error
 * message, and provides a convenient mechanism to check the validity of an
 * input itself (in which case it sets the input's validity state) or a raw
 * input value (in which case it just returns the result, with no side effects).
 */
export interface InputValidationFunction {
    (input: HTMLInputElement | string): boolean;
}

export const inputValidation = (
    checkFn: (input: string) => boolean,
    errorMessage: string
): InputValidationFunction => (input) => {
    const isInput = typeof input !== 'string';
    const inputValue = isInput ? input.value : input;

    if (isInput) {
        if (!inputValue || checkFn(inputValue)) {
            input.setCustomValidity('');
        } else {
            input.setCustomValidity(errorMessage);
        }
        input.reportValidity();
        return input.validity.valid;
    } else {
        return checkFn(inputValue);
    }
}