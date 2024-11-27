import * as polished from 'polished';

/**
 * Pairs with getBackgroundColor to generate a pair of colors with reasonable contrast,
 * inspired by a single base color, but aiming to broadly match a given main color &
 * background color.
 */
export function getTextColor(baseColor: string, mainColor: string, contrastRatio: number) {
    // Calculate a color difference from 0 (black/white) - 1 (identical)
    const baseSimilarity = (polished.getContrast(baseColor, mainColor) - 1) / 20;

    // Mix the colors, using between 35% & 100% of the base color, depending on how far
    // off we are and how much contrast we're aiming for (i.e. more maincolor for HC theme)
    const contrastBias = 1 - contrastRatio;
    const baseWeighting = 0.35 + (baseSimilarity * contrastBias) * 0.65;
    // More similar => less mixing required => more base color weighting

    return polished.mix(baseWeighting, baseColor, mainColor);
}

/**
 * Pairs with getTextColor to generate a pair of colors with reasonable contrast,
 * inspired by a single base color, but aiming to broadly match a given main color &
 * background color.
 */
export function getBackgroundColor(baseColor: string, mainBackgroundColor: string) {
    return polished.mix(0.3, baseColor, mainBackgroundColor);
}

