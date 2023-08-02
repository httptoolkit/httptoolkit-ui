import * as React from 'react';
import { shallow } from 'enzyme';

import { expect } from '../../../../test-setup';
import {
    CookieHeaderDescription
} from '../../../../../src/components/view/http/set-cookie-header-description';

describe('Set-Cookie header description', () => {
    it('should use sensible defaults for the minimal case', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').map(p => p.text())
        ).to.deep.equal([
            `Set cookie 'a' to 'b'`,
            'This cookie will be sent in future secure and insecure requests ' +
                'to example.com, but not its subdomains.',
            'The cookie is accessible from client-side scripts running on matching ' +
                'pages. Matching requests triggered from other origins will also include ' +
                'this cookie, if they are top-level navigations (not subresources).',
            'The cookie expires at the end of the current session.'
        ]);
    });

    it('should default the path to the request path', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b'
            requestUrl={new URL('http://example.com/abc/def')}
        />);

        expect(
            description.find('p').at(1).text()
        ).to.equal(
            'This cookie will be sent in future secure and insecure requests ' +
                'to example.com, but not its subdomains, ' +
                `for paths within '/abc'.`
        );
    });

    it('should explain explicit cookie paths', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Path=/a'
            requestUrl={new URL('http://example.com/abc/def')}
        />);

        expect(
            description.find('p').at(1).text()
        ).to.equal(
            'This cookie will be sent in future secure and insecure requests ' +
                'to example.com, but not its subdomains, ' +
                `for paths within '/a'.`
        );
    });

    it('should explain explicit cookie domains', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Domain=.example.com'
            requestUrl={new URL('http://www.example.com/')}
        />);

        expect(
            description.find('p').at(1).text()
        ).to.equal(
            'This cookie will be sent in future secure and insecure requests ' +
                'to example.com and subdomains.'
        );
    });

    it('should explain secure cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Secure'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(1).text()
        ).to.equal(
            'This cookie will be sent in future secure requests ' +
                'to example.com, but not its subdomains.'
        );
    });

    it('should explain HTTP-only cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; HttpOnly'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(2).text()
        ).to.equal(
            'The cookie is not accessible from client-side scripts. ' +
                'Matching requests triggered from other origins will however include this cookie, ' +
                'if they are top-level navigations (not subresources).'
        );
    });

    it('should explain Expires cookie expiry', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Expires=Fri, 1 Jan 2100 12:00:00 GMT'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(3).text()
        ).to.match(
            /^The cookie will expire in .* years.$/
        );
    });

    it('should explain Max-Age cookie expiry', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Max-Age=120'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(3).text()
        ).to.equal(
            'The cookie will expire in 2 minutes.'
        );
    });

    it('should explain Max-Age cookie expiry that overrides Expires', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Max-Age=120; Expires=Fri, 1 Jan 2100 12:00:00 GMT'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(3).text()
        ).to.equal(
            `The cookie will expire in 2 minutes ('max-age' overrides 'expires').`
        );
    });

    it('should explain Strict SameSite cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; SameSite=Strict'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(2).text()
        ).to.equal(
            'The cookie is accessible from client-side scripts running on matching pages, ' +
                'but will not be sent in requests triggered from other origins.'
        );
    });

    it('should explain Lax SameSite cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; SameSite=Lax'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(2).text()
        ).to.equal(
            'The cookie is accessible from client-side scripts running on matching pages. ' +
                'Matching requests triggered from other origins will also include this cookie, ' +
                'if they are top-level navigations (not subresources).'
        );
    });

    it('should explain None SameSite cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; Secure; SameSite=None'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').at(2).text()
        ).to.equal(
            'The cookie is accessible from client-side scripts running on matching pages. ' +
                'Matching requests triggered from other origins will also include this cookie.'
        );
    });

    it('should clearly reject insecure None SameSite cookies', () => {
        const description = shallow(<CookieHeaderDescription
            value='a=b; SameSite=None'
            requestUrl={new URL('http://example.com')}
        />);

        expect(
            description.find('p').map(p => p.text())
        ).to.deep.equal([
            `This attempts to set cookie 'a' to 'b'`,
            'This will fail so this cookie will not be set, because SameSite=None can ' +
                'only be used for cookies with the Secure flag.'
        ]);
    });
});