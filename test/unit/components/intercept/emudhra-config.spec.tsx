import * as React from 'react';
import { shallow } from 'enzyme';
import { expect } from '../../../test-setup';
import { EmudhraConfig } from '../../../../src/components/intercept/config/emudhra-config';
import { CopyableMonoValue } from '../../../../src/components/common/text-content';
import { ProxyStore } from '../../../../src/model/proxy-store';

const Config = (EmudhraConfig as any).wrappedComponent;

describe('eMudhra interception instructions', () => {
    const props = () => ({
        interceptor: {} as any,
        proxyStore: {
            externalNetworkAddresses: ['192.0.2.1', '::1'],
            enableExtraHttps: async (_name: string) => 8001
        } as ProxyStore,
        activateInterceptor: async () => { throw new Error('Unexpected server interceptor activation'); },
        reportStarted: () => {},
        reportSuccess: (_options?: { showRequests?: boolean }) => {},
        closeSelf: () => {}
    });

    it('shows the allocated port and manual instructions after activation', async () => {
        const config = props();
        let started = false;
        let showRequests: boolean | undefined;
        config.reportStarted = () => { started = true; };
        config.reportSuccess = options => { showRequests = options?.showRequests; };
        const view = shallow(<Config {...config} />, { disableLifecycleMethods: true });
        expect(view.text()).to.contain('Opening');
        await (view.instance() as any).enable();
        view.update();
        expect(started).to.equal(true);
        expect(showRequests).to.equal(false);
        const addresses = view.find(CopyableMonoValue).map(node => node.children().map(child => child.text()).join(''));
        expect(addresses).to.deep.equal([
            'http://localhost:8001', 'http://192.0.2.1:8001', 'http://[::1]:8001'
        ]);
        expect(view.find('p').map(node => node.text()).join(' ')).to.contain('Do not install additional certificates');
        view.unmount();
    });

    it('shows server errors and allows activation to be retried', async () => {
        const config = props();
        let attempts = 0;
        config.proxyStore.enableExtraHttps = async () => {
            if (++attempts === 1) throw new Error('No free port available');
            return 8002;
        };
        const view = shallow(<Config {...config} />, { disableLifecycleMethods: true });
        await (view.instance() as any).enable();
        view.update();
        expect(view.find({ role: 'alert' }).text()).to.contain('No free port available');
        await (view.instance() as any).enable();
        view.update();
        expect(view.find({ role: 'alert' }).exists()).to.equal(false);
        expect(view.find(CopyableMonoValue).first().children().map(child => child.text()).join('')).to.equal('http://localhost:8002');
        view.unmount();
    });
});
