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