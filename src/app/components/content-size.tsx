import * as React from "react";
import * as utf8 from 'utf8';

import { styled } from '../styles';

function getReadableSize(bytes: number, siUnits = true) {
    let thresh = siUnits ? 1000 : 1024;

    let units = siUnits
        ? ['bytes', 'kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['bytes', 'KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

    let i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(thresh));
    return (bytes / Math.pow(thresh, i)).toFixed(1).replace(/\.0$/, '') + ' ' + units[i];
}

export default styled(({ className, content }: { className?: string, content: string }) => <div
    className={className}
>
    {getReadableSize(utf8.encode(content).length)}
</div>)`
    display: inline-block;
    background-color: rgba(255,255,255,0.8);
    color: ${p => p.theme.popColor};

    border-radius: 4px;
    padding: 3px 8px 2px;
    margin: 0 10px;
    vertical-align: middle;

    font-size: 85%;
    font-weight: bold;
    text-transform: none;
`;