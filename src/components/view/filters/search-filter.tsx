import * as _ from 'lodash';
import * as React from 'react';
import { disposeOnUnmount, inject, observer } from 'mobx-react';
import { action, computed, observable } from 'mobx';
import { trackUndo } from 'mobx-shallow-undo';
import * as polished from 'polished';

import { css, styled } from '../../../styles';
import { copyToClipboard, isCmdCtrlPressed } from '../../../util/ui';

import {
    Filter,
    FilterSet,
    StringFilter,
    FilterClass,
    emptyFilterSet
} from '../../../model/filters/search-filters';
import {
    matchFilters,
    buildCustomFilter,
    CustomFilterClass
} from '../../../model/filters/filter-matching';
import { UiStore } from '../../../model/ui/ui-store';
import { AccountStore } from '../../../model/account/account-store';

import { IconButton, IconButtonLink } from '../../common/icon-button';
import { FilterTag } from './filter-tag';
import { FilterInput } from './filter-input';

const CLEAR_BUTTON_WIDTH = '30px';

const SearchFilterBox = styled.div<{ hasContents: boolean }>`
    position: relative;

    &:focus-within {
        border-color: ${p => p.theme.highlightColor};
    }

    flex-grow: 1;
    min-width: 0; /* Don't let flexbox force this to expand given long tags */
    padding-right: ${p => p.hasContents ? CLEAR_BUTTON_WIDTH : '0'};

    border-radius: 4px;

    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, ${p => p.theme.boxShadowAlpha / 2});
    background-color: ${p => p.theme.inputBackground};
    color: ${p => p.theme.highlightColor};

    font-size: ${p => p.theme.textSize};

    display: flex;

    &:hover, &:focus-within {
        flex-wrap: wrap;
    }
    &:not(:hover):not(:focus-within) {
        overflow: hidden;
    }

    /* Add a layer to act as a button background over non-wrapping content */
    &:after {
        content: "";
        position: absolute;
        display: block;

        z-index: 5;

        top: 4px;
        bottom: 4px;

        right: 0px;
        width: 36px;
        background: linear-gradient(
            to right,
            transparent 0%,
            ${p => polished.rgba(p.theme.inputBackground, 0.9)} 25%
        );
    }

    .react-autosuggest__container {
        flex-grow: 1;
        flex-basis: 100px; /* Shrink down to this, then wrap */
    }

    padding-bottom: 4px;
    > div {
        margin: 4px 0 0 4px;
    }
`;

const FloatingSearchButtonStyles = css`
    width: ${CLEAR_BUTTON_WIDTH};
    padding: 4px 10px;
    box-sizing: border-box;

    /* This isn't needed for button, but is for buttonlink - unclear why but it works */
    display: flex;
    align-items: center;

    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;

    /* Appears in front of the :after background layer */
    z-index: 10;
`;

const FloatingClearFiltersButton = styled(IconButton)`${FloatingSearchButtonStyles}`;
const FloatingFilterDocsButtonLink = styled(IconButtonLink)`
    ${FloatingSearchButtonStyles}
    opacity: 0.8;
`;

const deleteFilter = (filters: FilterSet, filter: Filter): FilterSet => {
    return [
        filters[0],
        ...filters.slice(1).filter((f, i) =>
            f !== filter // Keep all except our given filter
        )
    ] as const;
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

@inject('uiStore')
@inject('accountStore')
@observer
export class SearchFilter<T> extends React.Component<{
    uiStore?: UiStore,
    accountStore?: AccountStore,
    onFiltersConsidered: (filters: FilterSet | undefined) => void,
    availableFilters: FilterClass<T>[],
    filterSuggestionContext?: T,
    placeholder: string,
    searchInputRef?: React.Ref<HTMLInputElement>
}> {
    private boxRef = React.createRef<HTMLDivElement>();

    // Map HTML elements back to their corresponding filters, for selection tracking later
    private tagRefs = new Map<HTMLElement, Filter>();

    @observable.struct
    private selectedFilters: Filter[] = [];

    @computed
    private get activeFilters() {
        return this.props.uiStore!.activeFilterSet;
    }

    @action.bound
    onFiltersChanged(filters: FilterSet) {
        this.props.uiStore!.activeFilterSet = filters;
    }

    @computed
    private get availableFilters() {
        const builtInFilters = this.props.availableFilters;
        const customFilters = Object.entries(this.props.uiStore!.customFilters)
            .map(([name, filterString]) =>
                buildCustomFilter(name, filterString, builtInFilters)
            );

        return builtInFilters.concat(customFilters);
    }

    private readonly undoer = trackUndo(
        () => this.activeFilters,
        (value) => this.onFiltersChanged(value)
    );

    getSelectedFilters() {
        const selection = document.getSelection();
        if (!selection || selection.isCollapsed) {
            return [];
        }

        const { boxRef, tagRefs, activeFilters } = this;

        const filterBox = boxRef.current;
        if (filterBox) {
            // Manually map the input element to the string search filter. We
            // could probably do this with a ref, but it's messy, updating on
            // demand here is easier.
            tagRefs.set(filterBox.querySelector('input')!, activeFilters[0]);
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
    }

    updateSelectedTags = action(() => {
        this.selectedFilters = this.getSelectedFilters();
    })

    componentDidMount() {
        // Run the above, to match our internal selection state to the DOM, now and
        // every time the DOM's selection state updates whilst we're mounted:
        this.updateSelectedTags();

        document.addEventListener('selectionchange', this.updateSelectedTags);
        disposeOnUnmount(this, () => {
            document.removeEventListener('selectionchange', this.updateSelectedTags);
        });
    }

    private selectAllFilterTags() {
        const filterBox = this.boxRef.current;
        if (!filterBox) return;

        window.getSelection()!.setBaseAndExtent(
            filterBox, 0, // From the start (all tags)
            filterBox.querySelector('[role=listbox]')!, 0 // Up to but excluding the suggestions box
        );
        // ^ This will trigger selectionchange and then updateSelectedTags
    }

    private deleteSelectedFilters() {
        const { selectedFilters, onFiltersChanged, activeFilters } = this;

        const remainingInputText = selectedFilters.includes(activeFilters[0])
            ? ""
            : activeFilters[0].filter || '';

        onFiltersChanged([
            new StringFilter(remainingInputText),
            ...activeFilters.filter((f, i) =>
                i > 0 && !selectedFilters.includes(f)
            )
        ]);
    }

    private onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        const filterBox = this.boxRef.current;
        if (!filterBox) return;

        const { onFiltersChanged, activeFilters } = this;

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
            this.selectAllFilterTags();
            event.preventDefault();
            return;
        }

        if (event.key.toLowerCase() === 'z' && isCmdCtrlPressed(event)) {
            if (event.shiftKey) {
                this.undoer.redo();
            } else {
                this.undoer.undo();
            }
            event.preventDefault();
            return;
        }

        const filterTagElements = Array.from(filterBox.querySelectorAll('.filter-tag'));
        const filterInput = filterBox.querySelector('input')!;
        const filterElements = [...filterTagElements, filterInput] as HTMLElement[];

        const focusedElement = document.activeElement;
        const focusedElementIndex = filterElements.indexOf(focusedElement as HTMLElement);

        if (focusedElement !== filterInput && event.key === 'v' && isCmdCtrlPressed(event)) {
            // Inconsistently, onPaste doesn't fire on non-editable manually focused elements, and manually
            // simulating it is difficult (since we need clipboardData). Instead, we redirect all
            // pastes to the input field, which should always receive them correctly:
            filterInput.focus();
            const lastCursorPosition = filterInput.value.length;
            filterInput.setSelectionRange(lastCursorPosition, lastCursorPosition);
            return;
        }

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
                this.deleteSelectedFilters();
                document.getSelection()!.removeAllRanges();

                // If we don't delete the last filter tag, React will magically shift focus correctly for us,
                // because we index filter tags by key. If we delete the last though, we need to focus input manually:
                if (filterElements.length - lastSelectedIndex < 3) {
                    filterInput.focus();

                    // This shouldn't be required, but it seems reasonable (we're either deleting filters left of the
                    // input, or filters including all the input content). Without this, when ctrl-a selects the
                    // input entirely, focusing the input again here doesn't put the cursor back automatically.
                    filterInput.setSelectionRange(0, 0);
                }

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
                this.deleteSelectedFilters();
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
                    onFiltersChanged(
                        deleteFilterIndex(activeFilters, filterIndexToDelete)
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
    }

    private onCopy = (e: React.ClipboardEvent) => {
        const { activeFilters } = this;

        // Get the selected filters in reverse order (i.e. matching the UI order)
        const filtersToCopy = _.orderBy(this.getSelectedFilters(), f =>
            activeFilters.indexOf(f),
        ['desc']);

        if (filtersToCopy.length > 0) {
            const serialization = filtersToCopy.map(t => t.serialize()).join(' ');
            copyToClipboard(serialization);
            e.preventDefault();
        }
    }

    private onCut = (e: React.ClipboardEvent) => {
        this.onCopy(e);
        this.deleteSelectedFilters();
    }

    private onPaste = (e: React.ClipboardEvent<HTMLElement>) => {
        const filterBox = this.boxRef.current;
        const input = filterBox?.querySelector('input');
        if (!filterBox || !input) return;
        e.preventDefault();

        const {
            selectedFilters,
            activeFilters,
            onFiltersChanged,
            props: { availableFilters }
        } = this;

        const pastedText = e.clipboardData.getData("text");
        const pastedFilters = matchFilters(availableFilters, pastedText);

        const pastedStringInput = pastedFilters[0].filter;
        const selectionStart = input.selectionStart ?? 0;
        const selectionEnd = input.selectionEnd ?? 0;

        const currentTextInput = activeFilters[0].filter;

        const updatedTextInput = selectedFilters.includes(activeFilters[0])
            ? pastedStringInput // If whole stringfilter is selected, replace all text
            : ( // Otherwise, replace selected & paste at cursor position
                currentTextInput.slice(0, selectionStart) +
                pastedStringInput +
                currentTextInput.slice(selectionEnd)
            );

        // We *always* place pasted filters in position 1 (between text input and filter tags) because
        // pasting into non-input fields doesn't work reliably, so we redirect it to the input anyway.
        // This is nice and consistent, and works well enough for now.
        onFiltersChanged([
            new StringFilter(updatedTextInput),
            // Skip both StringFilters below, we've already combined them above:
            ...pastedFilters.slice(1),
            ...activeFilters.slice(1)
                .filter(f => !selectedFilters.includes(f)) // Paste deletes currently selected filters
        ]);

        // Jump the cursor to the end of the newly pasted content after render:
        requestAnimationFrame(() => {
            const endOfPastedContent = selectionStart + pastedStringInput.length;
            input.setSelectionRange(endOfPastedContent, endOfPastedContent);
            input.focus();
        });
    }

    private onInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { onFiltersChanged, activeFilters } = this;

        onFiltersChanged([
            new StringFilter(event.target.value),
            ...activeFilters.slice(1)
        ]);
    }

    private onFiltersCleared = () => {
        this.onFiltersChanged(emptyFilterSet());

        const textInput = (this.boxRef.current?.querySelector('input[type=text]') as HTMLElement | undefined);
        textInput?.focus();
    };

    @action.bound
    private onFiltersSaved(filters: Filter[], name: string) {
        const uiStore = this.props.uiStore!;

        // Save a custom filter using the provided input text
        uiStore.customFilters[name] = filters.map(f => f.serialize()).reverse().join(' ');

        // Clear the used input text
        uiStore.activeFilterSet = [
            new StringFilter(""),
            ...uiStore.activeFilterSet.slice(1)
        ];
    }

    @action.bound
    private onCustomFilterDeleted(filter: CustomFilterClass) {
        const uiStore = this.props.uiStore!;
        delete uiStore.customFilters[filter.filterName];
    }

    render() {
        const {
            boxRef,
            onCopy,
            onCut,
            onPaste,
            onKeyDown,
            onInputChanged,
            onFiltersCleared,
            onFiltersChanged,
            onFiltersSaved,
            onCustomFilterDeleted,

            tagRefs,
            selectedFilters,
            activeFilters,
            availableFilters,
            props: {
                accountStore,
                placeholder,
                searchInputRef,
                filterSuggestionContext,
                onFiltersConsidered
            }
        } = this;

        // Note that the model stores filters in the opposite order to how they're shown in the UI.
        // Mainly just because destructuring (of types & values) only works this way round.
        const [stringFilter, ...otherFilters] = activeFilters;

        // The text input always edits the first (last, in the UI) filter directly as a string
        const textInputValue = stringFilter?.filter ?? '';

        const hasContents = !!textInputValue || !!otherFilters.length;

        return <SearchFilterBox
            ref={boxRef}
            hasContents={hasContents}
            onCopy={onCopy}
            onCut={onCut}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
        >
            {
                otherFilters.reverse().map((f, i) =>
                    <FilterTag
                        key={i}
                        filter={f}
                        isSelected={selectedFilters.includes(f)}
                        onDelete={() => onFiltersChanged(
                            deleteFilter(activeFilters, f)
                        )}
                        ref={(ref) => { if (ref) tagRefs.set(ref, f); }}
                    />
                )
            }
            <FilterInput
                value={textInputValue}
                onChange={onInputChanged}
                label="Enter a string like 'hello' or a structured filter like hostname=google.com to filter the requests in the list"
                placeholder={otherFilters.length === 0
                    ? placeholder
                    : '...'
                }
                searchInputRef={searchInputRef}

                onFiltersConsidered={onFiltersConsidered}
                onFiltersChanged={onFiltersChanged}
                onFiltersSaved={onFiltersSaved}
                onCustomFilterDeleted={onCustomFilterDeleted}
                activeFilters={activeFilters}
                availableFilters={availableFilters}
                suggestionContext={filterSuggestionContext}

                isPaidUser={accountStore!.isPaidUser}
                getPro={accountStore!.getPro}
            />
            { hasContents
                ? <FloatingClearFiltersButton
                    title="Clear all search filters"
                    icon={['fas', 'times']}
                    onClick={onFiltersCleared}
                />
                : <FloatingFilterDocsButtonLink
                    icon={['fas', 'question']}
                    title="Open filtering docs"

                    href="https://httptoolkit.com/docs/reference/view-page/#filtering-intercepted-traffic"
                    target='_blank'
                    rel='noreferrer noopener'
                />
            }
        </SearchFilterBox>;
    }
}