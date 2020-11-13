import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../../styles';

import {
    Filter,
    FilterSet,
    StringFilter,
    FilterClass
} from '../../../model/filters/search-filters';

import { IconButton } from '../../common/icon-button';
import { FilterTag } from './filter-tag';
import { FilterInput } from './filter-input';
import { isCmdCtrlPressed } from '../../../util/ui';

const CLEAR_BUTTON_WIDTH = '30px';

const SearchFilterBox = styled.div<{ hasContents: boolean }>`
    position: relative;

    &:focus-within {
        border-color: ${p => p.theme.highlightColor};
    }

    flex-grow: 1;
    min-width: 0; /* Don't let flexbox force this to expand given long tags */
    padding: 2px ${p => p.hasContents ? CLEAR_BUTTON_WIDTH : '2px'} 2px 2px;

    border-radius: 4px;

    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, 0.1);
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-wrap: wrap;

    .react-autosuggest__container {
        flex-grow: 1;
        margin: 3px 0 3px 3px;

        &:not(:first-child) {
            margin-left: 0;
        }
    }
`;

const ClearSearchButton = styled(IconButton)`
    width: ${CLEAR_BUTTON_WIDTH};
    padding: 4px 10px;
    box-sizing: border-box;

    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
`;

const deleteFilter = (filters: FilterSet, filter: Filter): FilterSet => {
    return filters.filter((f, i) =>
        f !== filter || // Keep all except our given filter
        i === 0 // Never delete the 0th element - ensures it's always a valid FilterSet
    ) as FilterSet;
};

const deleteFilterIndex = (filters: FilterSet, index: number): FilterSet => {
    if (index === 0 || filters.length === 0) return filters; // No-op, we never remove the StringFilter
    else return [
        filters[0] as StringFilter,
        ...filters.slice(1, index),
        ...filters.slice(index + 1)
    ];
};

const getSelectedFilterElements = (filterBox: HTMLDivElement) => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) {
        return [];
    }

    return [
        ...Array.from(filterBox.querySelectorAll('.filter-tag')) as HTMLElement[],
        filterBox.querySelector('input') as HTMLElement
    ].filter((element) =>
        selection.containsNode(element, true) // True => include partial selection
    );
}

export const SearchFilter = React.memo((props: {
    searchFilters: FilterSet,
    onSearchFiltersConsidered: (filters: FilterSet | undefined) => void,
    onSearchFiltersChanged: (filters: FilterSet) => void,
    availableFilters: FilterClass[]
    placeholder: string,
    searchInputRef?: React.Ref<HTMLInputElement>
}) => {
    const boxRef = React.useRef<HTMLDivElement>(null);

    // Map HTML elements back to their corresponding filters, for selection tracking later
    const tagRefs = React.useMemo(() => new Map<HTMLElement, Filter>(), []);

    const [selectedFilters, setSelectedFilters] = React.useState<Filter[]>([]);

    const getSelectedFilters = React.useCallback(() => {
        const selection = document.getSelection();
        if (!selection || selection.isCollapsed) {
            return [];
        }

        const filterBox = boxRef.current;
        if (filterBox && props.searchFilters.length > 0) {
            // Manually map the input element to the string search filter. We could probably do this
            // with a ref, but it's messy, updating on demand here is easier.
            tagRefs.set(filterBox.querySelector('input')!, props.searchFilters[0]!);
        }

        // Update selectedFilters to match the filters selected for real in the document:
        const currentlySelectedFilters: Filter[] = [];
        Array.from(tagRefs.entries()).forEach(([tagElement, filter]) => {
            // Clean up any dangling filter element keys:
            if (!document.contains(tagElement)) {
                tagRefs.delete(tagElement);
                return;
            }

            if (selection.containsNode(tagElement, true)) { // True => include partial selection
                currentlySelectedFilters.push(filter);
            }
        });
        return currentlySelectedFilters;
    }, [boxRef, props.searchFilters, tagRefs]);

    const updateSelectedTags = React.useCallback(() => {
        setSelectedFilters(getSelectedFilters());
    }, [setSelectedFilters, getSelectedFilters]);

    // Run the above, to match our internal selection state to the DOM, every time the
    // DOM's selection state updates whilst we're mounted:
    React.useEffect(() => {
        updateSelectedTags();
        document.addEventListener('selectionchange', updateSelectedTags);
        return () => {
            updateSelectedTags();
            document.removeEventListener('selectionchange', updateSelectedTags);
        }
    }, [updateSelectedTags]);

    const selectAllFilterTags = React.useCallback(() => {
        const filterBox = boxRef.current;
        if (!filterBox) return;

        window.getSelection()!.setBaseAndExtent(
            filterBox, 0, // From the start (all tags)
            filterBox.querySelector('[role=listbox]')!, 0 // Up to but excluding the suggestions box
        );
        // ^ This will trigger selectionchange and then updateSelectedTags
    }, [boxRef]);

    const deleteSelectedFilters = React.useCallback(() => {
        const remainingInputText = props.searchFilters[0] && selectedFilters.includes(props.searchFilters[0])
            ? ""
            : props.searchFilters[0]?.filter || ''

        props.onSearchFiltersChanged([
            new StringFilter(remainingInputText),
            ...props.searchFilters.filter((f, i) =>
                i > 0 && !selectedFilters.includes(f)
            )
        ]);
    }, [selectedFilters]);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        const filterBox = boxRef.current;
        if (!filterBox) return;

        const selectedFilterElements = getSelectedFilterElements(filterBox);

        if (!filterBox.contains(document.activeElement)) {
            // Somehow the focus & input is going elsewhere. Ignore this,
            // and clear our selection entirely if we have one. Unlikely to
            // happen in normal behaviour, this is here as a backstop.
            if (selectedFilterElements) {
                document.getSelection()!.removeAllRanges();
            }
            return;
        }

        if (event.key === 'a' && isCmdCtrlPressed(event)) {
            // If you select-all, select both the filters and the input
            selectAllFilterTags();
            event.preventDefault();
            return;
        }

        const filterTagElements = Array.from(filterBox.querySelectorAll('.filter-tag'));
        const filterInput = filterBox.querySelector('input')!;
        const filterElements = [...filterTagElements, filterInput] as HTMLElement[];

        const focusedElement = document.activeElement;
        const focusedElementIndex = filterElements.indexOf(focusedElement as HTMLElement);
        if (focusedElementIndex === -1) return; // These key bindings apply only to the input & tags:

        if (selectedFilterElements.length > 0) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                const indexToSelect = event.key === 'ArrowLeft'
                    ? 0
                    : selectedFilterElements.length - 1;

                const elementToSelect = selectedFilterElements[indexToSelect];

                document.getSelection()!.removeAllRanges();
                elementToSelect.focus();

                if (elementToSelect === filterInput) {
                    const cursorPosition = event.key === 'ArrowLeft'
                        ? 0
                        : filterInput.value.length;
                    filterInput.setSelectionRange(cursorPosition, cursorPosition);
                }
                event.preventDefault();
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
                const lastSelectedIndex = filterElements.indexOf(selectedFilterElements[selectedFilterElements.length - 1]);
                deleteSelectedFilters();
                document.getSelection()!.removeAllRanges();

                // If we don't delete the last filter tag, React will magically shift focus correctly for us,
                // because we index filter tags by key. If we delete the last though, we need to focus input manually:
                if (filterElements.length - lastSelectedIndex < 3) filterInput.focus();

                event.preventDefault();
            } else if (event.key === 'Escape') {
                document.getSelection()!.removeAllRanges();

                filterInput.focus();
                const inputEndPosition = filterInput.value.length;
                filterInput.setSelectionRange(inputEndPosition, inputEndPosition);
                event.preventDefault();
            } else if (
                [...event.key].length === 1 && // Exactly equivalent to 'printable character', AFAICT
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey
            ) {
                const inputCursorPosition = filterInput.selectionStart || filterInput.value.length;
                deleteSelectedFilters();
                document.getSelection()!.removeAllRanges();

                // Direct the input directly into the text field:
                filterInput.setSelectionRange(inputCursorPosition, inputCursorPosition);
                filterInput.focus();
            }
            // -> else we just fire the key event as normal, come what may
        } else if (filterInput.selectionStart === filterInput.selectionEnd) {
            // Otherwise, as long as nothing is selected in the input, we're just handling a cursor:
            const inputCursorIndex = filterInput.selectionStart ?? -1;
            const isInputSelected = focusedElement === filterInput;

            if (event.key === 'Backspace' || event.key === 'Delete') {
                // We're deleting something (or a char in the input). Remember that UI order
                // is reversed, so we map the element index to an index in the model:
                let filterIndexToDelete = !isInputSelected
                    ? filterElements.length - 1 - focusedElementIndex // Delete the selected filter
                : inputCursorIndex <= 0 && event.key === 'Backspace'
                    ? 1 // Delete back from the start of the input -> delete the first non-string filter
                : null; // We're within text in the input, do nothing (i.e. delete a char as normal)

                if (filterIndexToDelete) {
                    props.onSearchFiltersChanged(
                        deleteFilterIndex(props.searchFilters, filterIndexToDelete)
                    );

                    // If we're not the last filter tag, React will magically shift focus to the next for us,
                    // because we index elements by key. If we are last though, we need to shift manually:
                    if (filterIndexToDelete === 1) filterInput.focus();
                    event.preventDefault();
                }
            } else if (event.key === 'ArrowLeft' && focusedElementIndex > 0 && inputCursorIndex <= 0) {
                filterElements[focusedElementIndex - 1].focus();
                event.preventDefault();
            } else if (event.key === 'ArrowRight' && focusedElementIndex < filterElements.length - 1) {
                const nextFilter = filterElements[focusedElementIndex + 1];
                nextFilter.focus();
                if (nextFilter === filterInput) filterInput.setSelectionRange(0, 0);
                event.preventDefault();
            }
        }
    }, [boxRef, props.onSearchFiltersChanged, props.searchFilters, selectAllFilterTags, deleteSelectedFilters]);

    const onCopy = React.useCallback((e: React.ClipboardEvent) => {
        // Get the selected filters in reverse order (i.e. matching the UI order)
        const filtersToCopy = _.orderBy(getSelectedFilters(), f =>
            (props.searchFilters as Filter[]).indexOf(f),
        ['desc']);

        if (filtersToCopy.length > 0) {
            const serialization = filtersToCopy.map(t => t.serialize()).join(' ');
            navigator.clipboard.writeText(serialization);
            e.preventDefault();
        }
    }, [getSelectedFilters, props.searchFilters]);

    const onCut = React.useCallback((e: React.ClipboardEvent) => {
        onCopy(e);
        deleteSelectedFilters();
    }, [onCopy, deleteSelectedFilters]);

    const onInputChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        props.onSearchFiltersChanged([
            new StringFilter(event.target.value),
            ...props.searchFilters.slice(1)
        ]);
    }, [props.onSearchFiltersChanged, props.searchFilters]);

    const onFiltersCleared = React.useCallback(() => {
        props.onSearchFiltersChanged([]);

        const textInput = (boxRef.current?.querySelector('input[type=text]') as HTMLElement | undefined);
        textInput?.focus();
    }, [props.onSearchFiltersChanged, boxRef]);

    // Note that the model stores filters in the opposite order to how they're shown in the UI.
    // Mainly just because destructuring (of types & values) only works this way round.
    const [stringFilter, ...otherFilters] = props.searchFilters;

    // The text input always edits the first (last, in the UI) filter directly as a string
    const textInputValue = stringFilter?.filter ?? '';

    const hasContents = !!textInputValue || !!otherFilters.length;

    return <SearchFilterBox
        ref={boxRef}
        hasContents={hasContents}
        onCopy={onCopy}
        onCut={onCut}
        onKeyDown={onKeyDown}
    >
        {
            otherFilters.reverse().map((f, i) =>
                <FilterTag
                    key={i}
                    filter={f}
                    isSelected={selectedFilters.includes(f)}
                    onDelete={() => props.onSearchFiltersChanged(
                        deleteFilter(props.searchFilters, f)
                    )}
                    ref={(ref) => { if (ref) tagRefs.set(ref, f); }}
                />
            )
        }
        <FilterInput
            value={textInputValue}
            onChange={onInputChanged}
            placeholder={props.placeholder}
            searchInputRef={props.searchInputRef}

            onFiltersConsidered={props.onSearchFiltersConsidered}
            onFiltersChanged={props.onSearchFiltersChanged}
            currentFilters={props.searchFilters}
            availableFilters={props.availableFilters}
        />
        { hasContents &&
            <ClearSearchButton
                title="Clear all search filters"
                icon={['fas', 'times']}
                onClick={onFiltersCleared}
            />
        }
    </SearchFilterBox>;
});