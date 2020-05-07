import {
    IconPrefix,
    IconDefinition,
    IconName
} from '@fortawesome/fontawesome-svg-core';

export const customSpinnerArc: IconDefinition = {
    // Based on https://codepen.io/aurer/pen/jEGbA
    prefix: <IconPrefix>'fac',
    iconName: <IconName>'spinner-arc',
    icon: [
        // height x width
        50, 50,
        [],
        '',
        // SVG path
        'M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z'
    ]
};