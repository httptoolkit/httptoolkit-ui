import * as polished from 'polished';

import * as styles from "../../src/styles";
import { EventCategories, getMethodColor, getSummaryColor } from "../../src/model/events/categorization";
import { MethodNames } from "../../src/model/http/methods";
import {
    getTextColor,
    getBackgroundColor
} from "../../src/util/colors";
import { expect } from '../test-setup';

([
    ['Light', styles.lightTheme],
    ['Dark', styles.darkTheme],
    ['HC', styles.highContrastTheme]
] as const).forEach(([themeName, theme]) => {

    const normalContrastTarget = themeName === 'HC'
        ? 7 // AAA normal text minimum for HC theme
        : 4.5; // AA normal or AAA large/bold text

    // For very large & relatively unimportant text:
    const lowerContrastTarget = themeName === 'HC'
        ? 4.5 // AAA large/bold text (AA normal) for HC theme
        : 3; // AA large/bold text

    describe(`The ${themeName} theme`, () => {

        describe("standard color pairings", () => {

            it("should have sufficient main text contrast", () => {
                const mainColor = theme.mainColor;
                const bgColor = theme.mainBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient highlight text contrast", () => {
                const mainColor = theme.highlightColor;
                const bgColor = theme.highlightBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient lowlight text contrast", () => {
                const mainColor = theme.mainColor;
                const bgColor = theme.mainLowlightBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient input field contrast", () => {
                const mainColor = theme.inputColor;
                const bgColor = theme.inputBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient input warning contrast", () => {
                const mainColor = theme.inputWarningPlaceholder;

                // Warning background is #RRGGBBAA, so we need to mix to check the real bg colour:
                const warningBackgroundColor = theme.warningBackground.slice(0, 7);
                const warningBackgroundOpacity = theme.warningBackground.slice(7, 9);
                const warningBackgroundRatio = parseInt(warningBackgroundOpacity, 16) / 255;

                const bgColor = polished.mix(
                    warningBackgroundRatio,
                    warningBackgroundColor,
                    theme.mainBackground
                );

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient input placeholder contrast", () => {
                const mainColor = theme.inputPlaceholderColor;
                const bgColor = theme.inputBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient primary button contrast", () => {
                const mainColor = theme.primaryInputColor;
                const bgColor = theme.primaryInputBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient secondary button contrast", () => {
                const mainColor = theme.secondaryInputColor;
                const bgColor = theme.mainBackground; // Secondary inputs have no background

                const contrast = polished.getContrast(mainColor, bgColor);
                // Lower target as these are usually icons (so generally only require 3:1)
                expect(contrast).to.be.greaterThan(lowerContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient main-on-container text contrast", () => {
                const mainColor = theme.mainColor;
                const bgColor = theme.containerBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

            it("should have sufficient container watermark contrast", () => {
                const mainColor = theme.containerWatermark;
                const bgColor = theme.containerBackground;

                const contrast = polished.getContrast(mainColor, bgColor);
                // Lower target as this is enormous (and non-critical) background text
                expect(contrast).to.be.greaterThan(lowerContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

        });

        describe("color pair generation", () => {

            EventCategories.forEach((category) => {
                const categoryColor = getSummaryColor(category);

                it(`should generate sufficient contrast for the ${category} category (${categoryColor})`, () => {
                    const mainColor = getTextColor(categoryColor, theme.mainColor, theme.pillContrast);
                    const bgColor = getBackgroundColor(categoryColor, theme.mainBackground);

                    const contrast = polished.getContrast(mainColor, bgColor);
                    expect(contrast).to.be.greaterThan(normalContrastTarget,
                        `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                    );
                });
            });


            MethodNames.forEach((method) => {
                const methodColor = getMethodColor(method);
                it(`should generate sufficient contrast for ${method} methods (${methodColor})`, () => {
                    const mainColor = getTextColor(methodColor, theme.mainColor, theme.pillContrast);
                    const bgColor = getBackgroundColor(methodColor, theme.mainBackground);

                    const contrast = polished.getContrast(mainColor, bgColor);
                    expect(contrast).to.be.greaterThan(normalContrastTarget,
                        `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                    );
                });
            });

            it(`should generate sufficient contrast for the default pill colours`, () => {
                const mainColor = getTextColor(theme.pillDefaultColor, theme.mainColor, theme.pillContrast);
                const bgColor = getBackgroundColor(theme.pillDefaultColor, theme.mainBackground);

                const contrast = polished.getContrast(mainColor, bgColor);
                expect(contrast).to.be.greaterThan(normalContrastTarget,
                    `Contrast for ${mainColor}/${bgColor} was only ${contrast}`
                );
            });

        });

    });

});