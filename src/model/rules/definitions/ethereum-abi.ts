/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import { defaultAbiCoder } from '@ethersproject/abi';

export const encodeAbi = defaultAbiCoder.encode.bind(defaultAbiCoder);

export const NATIVE_ETH_TYPES = [
    'bool',
    'int',
    'uint',
    ...(_.flatMap(_.range(8, 257, 8), (bits) => [
        `int${bits}`,
        `uint${bits}`
    ])),
    'address',
    'string',
    'bytes',
    ...(_.range(1, 33).map((n) => `bytes${n}`))
];