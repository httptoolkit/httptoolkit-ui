// Not clear why this is necessary, but it seems to be. Something to do with chai-enzyme?
/// <reference path="../../../../../custom-typings/chai-deep-match.d.ts" />

import * as React from 'react';
import { shallow } from 'enzyme';

import { expect } from '../../../../test-setup';
import {
    UserAgentHeaderDescription
} from '../../../../../src/components/view/headers/user-agent-header-description';

const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36';

describe('User agent header description', () => {
    it('should show detailed info for known clients', () => {
        const description = shallow(
            <UserAgentHeaderDescription value={WINDOWS_CHROME} />
        );

        expect(
            description.find('p').at(0).text()
        ).to.equal(
            'This request came from Chrome 60, which uses the ' +
                'Blink engine. The device is running Windows 10, with ' +
                'an amd64 CPU.'
        );
    });

    it('should show the default HTTP docs for unknown clients', () => {
        const description = shallow(<UserAgentHeaderDescription
            value={'git/2.20.1'}
        />);

        expect(
            description.find('p').at(0).text()
        ).to.equal(
            'The User-Agent request header contains a characteristic string that ' +
            'allows the network protocol peers to identify the application type, ' +
            'operating system, software vendor or software version of the requesting ' + 'software user agent.'
        );
    });
});