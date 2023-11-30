import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../styles';
import { Icon } from '../../icons';
import { useSize } from '../../util/ui';

const VisibleButtonsContainer = styled.div`
    overflow: hidden;
    display: flex;
    flex-direction: inherit;
`;

const HiddenButtonsWrapper = styled.div`
    position: relative;
`;

const HiddenButtonsContainer = styled.div`
    position: absolute;
    left: 0;
    top: 100%;
    z-index: 1;
    display: flex;
    flex-direction: column;

    background-color: ${p => p.theme.mainBackground};
    padding-bottom: 2px;

    opacity: 0;
    pointer-events: none;
    &:hover, &:focus-within {
        opacity: 1;
        pointer-events: auto;
    }
`;

const ButtonContainer = styled.div`
    flex-grow: 1;
    flex-shrink: 1;
    min-width: 0;

    position: relative;
    display: flex;

    /* Try to avoid button padding expanding outer containers */
    margin: -5px -9px;

    /* Match the parent (typically card header) flex direction, but justify
       content in the opposite direction */
    flex-direction: inherit;
    justify-content: flex-start;
`;

const MenuButton = styled(Icon)`
    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.textSize};
    padding: 5px 10px;

    &:hover + ${HiddenButtonsContainer} {
        opacity: 1;
        pointer-events: auto;
    }
`;

function unfocus() {
    if ('blur' in (document.activeElement || {})) {
        (document.activeElement as HTMLElement).blur();
    }
}

export const CollapsingButtons = (p: { children: React.ReactNode, className?: string }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const spaceAvailable = useSize(containerRef, Infinity);

    containerRef.current?.children

    const childElements = Array.from(
        containerRef.current?.querySelectorAll('button') || []
    );
    const itemWidth = _.max(childElements.map(c => c.clientWidth));
    const itemSpacesAvailable = itemWidth
        ? Math.max(Math.floor(spaceAvailable / itemWidth), 1) // Always show at least one button
        : Infinity;

    const children = React.Children.toArray(p.children);

    const [visibleChildren, hiddenChildren] = itemSpacesAvailable >= children.length
        ? [children, []]
        : [children.slice(0, itemSpacesAvailable - 1), children.slice(itemSpacesAvailable - 1)]

    return <ButtonContainer ref={containerRef} className={p.className}>
        <VisibleButtonsContainer>
            { visibleChildren }
        </VisibleButtonsContainer>
        { hiddenChildren.length > 0 && <HiddenButtonsWrapper>
            <MenuButton
                icon={['fas', 'caret-down']}
                title="Show more"
            />
            <HiddenButtonsContainer
                // Need to ensure that the menu doesn't stick open if you click an item
                onClick={unfocus}
            >
                { hiddenChildren }
            </HiddenButtonsContainer>
        </HiddenButtonsWrapper> }
    </ButtonContainer>
};