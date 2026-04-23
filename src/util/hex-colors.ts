import * as polished from 'polished';
import type * as MonacoTypes from 'monaco-editor';

// 16 hue angles for nibble groups 0x0_ through 0xF_, manually spaced for
// visual distinctness in HSL:
const NIBBLE_HUES = [
    0,    // 0x0_: red
    25,   // 0x1_: orange
    45,   // 0x2_: gold
    60,   // 0x3_: yellow
    80,   // 0x4_: yellow-green
    120,  // 0x5_: green
    155,  // 0x6_: teal
    175,  // 0x7_: cyan
    200,  // 0x8_: sky blue
    220,  // 0x9_: blue
    245,  // 0xA_: indigo
    270,  // 0xB_: purple
    290,  // 0xC_: violet
    315,  // 0xD_: magenta
    335,  // 0xE_: pink
    350,  // 0xF_: rose
] as const;

const HEX_DIGITS = '0123456789ABCDEF';
const SATURATION = 0.75;

/**
 * For a given HSL hue and saturation, binary-search for the lightness closest
 * to 0.5 (maximizing saturation appearance) that still meets the target
 * contrast ratio against the given background.
 */
function findContrastingLightness(
    hue: number,
    saturation: number,
    background: string,
    minContrast: number
): number {
    const isDarkBg = polished.getLuminance(background) < 0.5;

    // On dark backgrounds we need lighter text (search upward from 0.35),
    // on light backgrounds we need darker text (search downward from 0.65).
    let lo = isDarkBg ? 0.35 : 0.05;
    let hi = isDarkBg ? 0.95 : 0.65;

    for (let i = 0; i < 25; i++) {
        const mid = (lo + hi) / 2;
        const contrast = polished.getContrast(polished.hsl(hue, saturation, mid), background);

        if (isDarkBg) {
            // Higher lightness = more contrast; find the minimum that meets target
            if (contrast >= minContrast) hi = mid; else lo = mid;
        } else {
            // Lower lightness = more contrast; find the maximum that meets target
            if (contrast >= minContrast) lo = mid; else hi = mid;
        }
    }

    return (lo + hi) / 2;
}

function nibbleTokenName(nibbleIndex: number): string {
    return `hex-${HEX_DIGITS[nibbleIndex].toLowerCase()}x`;
}

export interface HexColors {
    /** 16 colors, one per leading nibble (index 0 = 0x0_, index 15 = 0xF_) */
    nibbleColors: string[];
    /** Desaturated color for 0x00 (null) bytes */
    zeroColor: string;
    /** High-contrast grey for 0xFF bytes */
    ffColor: string;
}

/**
 * Generate hex byte colors meeting the given contrast ratio against the
 * editor background. Uses a rainbow of hues for each leading nibble, with
 * desaturated special cases for 0x00 and 0xFF.
 */
export function generateHexColors(editorBackground: string, minContrast: number): HexColors {
    const isDarkBg = polished.getLuminance(editorBackground) < 0.5;

    const nibbleColors = NIBBLE_HUES.map((hue) => {
        const lightness = findContrastingLightness(hue, SATURATION, editorBackground, minContrast);
        return polished.hsl(hue, SATURATION, lightness);
    });

    // 0x00: desaturated grey, just meeting contrast minimum
    const zeroLightness = findContrastingLightness(0, 0, editorBackground, minContrast);
    const zeroColor = polished.hsl(0, 0, zeroLightness);

    // 0xFF: high-contrast grey (near-black on light, near-white on dark)
    const ffLightness = isDarkBg ? 0.93 : 0.07;
    const ffColor = polished.hsl(0, 0, ffLightness);

    return { nibbleColors, zeroColor, ffColor };
}

/**
 * Convert generated hex colors into Monaco theme token color rules.
 */
export function buildHexTokenRules(colors: HexColors): Array<{ token: string; foreground: string }> {
    const rules: Array<{ token: string; foreground: string }> = [
        { token: 'hex-00', foreground: toMonacoHex(colors.zeroColor) },
        { token: 'hex-ff', foreground: toMonacoHex(colors.ffColor) },
    ];

    for (let i = 0; i < 16; i++) {
        rules.push({
            token: nibbleTokenName(i),
            foreground: toMonacoHex(colors.nibbleColors[i])
        });
    }

    return rules;
}

function toMonacoHex(color: string): string {
    const { red, green, blue } = polished.parseToRgb(color);
    return [red, green, blue].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Monarch tokenizer for hex-formatted content (space-separated uppercase
 * hex byte pairs, as produced by bufferToHex).
 */
export function getHexMonarchDefinition(): MonacoTypes.languages.IMonarchLanguage {
    const rules: Array<[RegExp, string]> = [
        // Special cases first (must precede general nibble rules)
        [/00/, 'hex-00'],
        [/FF/, 'hex-ff'],
    ];

    // One rule per leading nibble
    for (let i = 0; i < 16; i++) {
        const digit = HEX_DIGITS[i];
        rules.push([new RegExp(`${digit}[0-9A-F]`), nibbleTokenName(i)]);
    }

    // Whitespace between hex pairs and catch-all for non-hex text
    rules.push([/\s+/, '']);
    rules.push([/./, '']);

    return {
        tokenizer: { root: rules }
    } as MonacoTypes.languages.IMonarchLanguage;
}
