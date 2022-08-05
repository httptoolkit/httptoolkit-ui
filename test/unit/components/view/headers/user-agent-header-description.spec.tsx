import * as React from 'react';
import { shallow } from 'enzyme';

import { expect } from '../../../../test-setup';
import {
    UserAgentHeaderDescription
} from '../../../../../src/components/view/http/user-agent-header-description';

const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36';

describe('User agent header description', () => {
    it('should show detailed info for known clients', () => {
        const description = shallow(
            <UserAgentHeaderDescription value={WINDOWS_CHROME} />
        );

        expect(
            description.find('p').at(0).text()
        ).to.equal(
            'This request came from Chrome 60, based on the ' +
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
            'The User-Agent request header is a characteristic string that lets ' +
            'servers and network peers identify the application, operating system, ' +
            'vendor, and/or version of the requesting user agent.'
        );
    });
});