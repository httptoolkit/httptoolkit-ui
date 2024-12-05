// Partially taken from https://github.com/jshttp/cookie under MIT license,
// heavily rewritten with setCookie support added.

export interface Cookie {
    name: string;
    value: string;
}

export interface SetCookie extends Cookie {
    path?: string;
    httponly?: boolean;
    secure?: boolean;
    samesite?: string;
    domain?: string;
    expires?: string;
    'max-age'?: string;
    [key: string]: string | boolean | undefined;
}

export function parseSetCookieHeader(
    headers: string | string[]
): SetCookie[] {
    if (!Array.isArray(headers)) {
        headers = [headers];
    }

    const cookies: Array<SetCookie> = [];

    for (const header of headers) {
        const [cookieKV, ...parts] = header.split(";");

        const [name, value] = (cookieKV?.split("=") ?? []);
        if (!name || value === undefined) continue;

        const cookie: SetCookie = {
            name,
            value
        };

        for (const part of parts) {
            let [key, val] = part.split("=");
            key = key.trim().toLowerCase();
            val = val?.trim() ?? true;
            cookie[key] = val;
        }

        cookies.push(cookie);
    }

    return cookies;
}

export function parseCookieHeader(
    str: string
): Array<Cookie> {
    const cookies: Array<Cookie> = [];
    const len = str.length;
    // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
    if (len < 2) return cookies;

    let index = 0;

    do {
        const eqIdx = str.indexOf("=", index);
        if (eqIdx === -1) break; // No more cookie pairs.

        const colonIdx = str.indexOf(";", index);
        const endIdx = colonIdx === -1 ? len : colonIdx;

        if (eqIdx > endIdx) {
            // backtrack on prior semicolon
            index = str.lastIndexOf(";", eqIdx - 1) + 1;
            continue;
        }

        const nameStartIdx = startIndex(str, index, eqIdx);
        const nameEndIdx = endIndex(str, eqIdx, nameStartIdx);
        const name = str.slice(nameStartIdx, nameEndIdx);

        const valStartIdx = startIndex(str, eqIdx + 1, endIdx);
        const valEndIdx = endIndex(str, endIdx, valStartIdx);
        const value = decode(str.slice(valStartIdx, valEndIdx));

        cookies.push({ name: name, value });

        index = endIdx + 1;
    } while (index < len);

    return cookies;
}

function startIndex(str: string, index: number, max: number) {
    do {
      const code = str.charCodeAt(index);
      if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) return index;
    } while (++index < max);
    return max;
}

function endIndex(str: string, index: number, min: number) {
    while (index > min) {
      const code = str.charCodeAt(--index);
      if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) return index + 1;
    }
    return min;
}

function decode(str: string): string {
    if (str.indexOf("%") === -1) return str;

    try {
        return decodeURIComponent(str);
    } catch (e) {
        return str;
    }
}