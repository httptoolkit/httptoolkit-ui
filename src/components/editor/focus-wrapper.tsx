import * as _ from 'lodash';
import * as React from 'react';

const focusableElementSelector = [
    'a:not([disabled])',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([disabled]):not([tabindex="-1"])'
].join(',');

function getFocusableChildren(element: HTMLElement) {
    // Note that we ignore numerical tabindexes entirely, since we never use them
    return _.filter(
        (element.querySelectorAll(focusableElementSelector) as NodeListOf<HTMLElement>),
        (element) => element.offsetParent !== null // Element is visible (ish)
    )
}

// Wraps an element (i.e. the Monaco editor), and blocks focusing it directly in the tab order.
// This is necessary for elements which capture tab/shift-tab for some other use (as Monaco does).
// Focus can be explicitly given by pressing Enter, or removed with Escape.
export const FocusWrapper = (p: { children: React.ReactNode, className?: string }) => {
    return <div
        className={p.className}
        aria-label='Press enter to focus this editor, and use escape to unfocus it later'
        tabIndex={0}
        onKeyDown={(e) => {
            const thisElement = e.currentTarget;
            if (e.target === thisElement) {
                // Pressing tab with the container focused jumps past the children
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        // Pressing shift-tab tabs backwards from this element, so just like normal
                        return;
                    } else {
                        // Pressing tab tabs forwards past all the children of this element.
                        const allFocusableElements = getFocusableChildren(document.body);
                        const elementLastChild = _.last(thisElement.children) as HTMLElement;
                        const currentTabIndex = allFocusableElements.indexOf(elementLastChild);

                        const nextTabbableElement = allFocusableElements[currentTabIndex + 1];
                        if (nextTabbableElement) {
                            nextTabbableElement.focus();
                            e.preventDefault();
                            return;
                        } else {
                            // If we can't find a next tabbable element, loop back to the first
                            allFocusableElements[0].focus();
                            e.preventDefault();
                            return;
                        }
                    }
                }

                // Pressing enter with the container focused jumps into the children
                if (e.key === 'Enter') {
                    const firstFocussableChild = getFocusableChildren(thisElement)[0];
                    if (firstFocussableChild) {
                        firstFocussableChild.focus();
                        e.preventDefault(); // Don't actually press enter on the child element
                    }
                    return;
                }
            } else if (thisElement.contains(document.activeElement)) {
                // Pressing escape inside the container jumps to the container
                if (e.key === 'Escape') {
                    thisElement.focus();
                    return;
                }
            }
        }}
    >
        { p.children }

        {/* If you shift-tab into the children, we focus the container */}
        <div tabIndex={0} onFocus={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.parentElement!.focus();
        }} />
    </div>;
}