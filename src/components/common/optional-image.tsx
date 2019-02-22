import * as React from 'react';

function showOnceLoaded(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const elem = e.target as HTMLImageElement;
    elem.style.display = 'initial';
}

// An img element which isn't shown at all, until it successfully loads
export const OptionalImage = (p: React.ImgHTMLAttributes<HTMLImageElement>) =>
        <img {...p} onLoad={showOnceLoaded} style={{ display: 'none' }} />
