export function truncate(str: string, length: number) {
    if (str.length <= length) {
        return str;
    } else {
        return str.slice(0, length - 3) + "...";
    }
}

export function joinAnd(val: string[], initialSep = ', ', finalSep = ' and ') {
    if (val.length === 1) return val[0];

    return val.slice(0, -1).join(initialSep) + finalSep + val[val.length - 1];
}

const VOWEL_ISH = ['a', 'e', 'i', 'o', 'u', 'y'];
export function aOrAn(value: string) {
    if (VOWEL_ISH.includes(value[0].toLowerCase())) return 'an';
    else return 'a';
}

export function uppercaseFirst(value: string) {
    return value[0].toUpperCase() + value.slice(1);
}

export function camelToSentenceCase(value: string) {
    return uppercaseFirst(
        value.replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase()
    );
}

const sigFig = (num: number, figs: number): string =>
    num.toFixed(figs);

export const formatDuration = (duration: number) =>
    duration < 100 ? sigFig(duration, 1) + 'ms' : // 22.3ms
        duration < 1000 ? sigFig(duration, 0) + 'ms' : // 999ms
            duration < 5000 ? sigFig(duration / 1000, 2) + 's' : // 3.04s
                duration < 59000 ? sigFig(duration / 1000, 1) + 's' : // 30.2s
                    sigFig(duration / 60000, 1) + 'm' // 1.1m