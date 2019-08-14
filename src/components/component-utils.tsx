import * as _ from 'lodash';
import * as React from 'react';

export function filterProps<T extends object, K extends string>(
    Component: React.ComponentType<T>,
    ...keys: K[]
): React.ComponentType<T> {
    return (props: T) => <Component {..._.omit(props, keys) as T} />;
}

// Trigger the click handler when Enter is pressed on this element
export function clickOnEnter<T extends Element>(e: React.KeyboardEvent<T>) {
    if (e.target === e.currentTarget && e.key === 'Enter') {
        // Can't use .click(), as sometimes our target is an SVGElement, and they don't have it
        e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
}