import * as React from 'react';

import { styled } from '../../styles';

// The image viewer, as used in content viewer editors when the image format
// is selected from the dropdown:
export const ImageViewer = styled((p: {
    className?: string
    content: Buffer,
    rawContentType: string
}) => <img
    className={p.className}
    src={`data:${p.rawContentType || ''};base64,${p.content.toString('base64')}`}
/>)`
    display: block;
    max-width: 100%;
    max-height: 100%;
    margin: 0 auto;
    object-fit: scale-down;
`;