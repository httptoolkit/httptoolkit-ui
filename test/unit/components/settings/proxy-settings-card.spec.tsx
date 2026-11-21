import * as React from 'react';
import { shallow } from 'enzyme';
import { observable } from 'mobx';
import { expect } from '../../../test-setup';
import { ProxyStore } from '../../../../src/model/proxy-store';
import { ApiError } from '../../../../src/services/server-api-types';
import { ProxySettingsCard } from '../../../../src/components/settings/proxy-settings-card';

const ProxySettings = (ProxySettingsCard as any).wrappedComponent;

describe('TLS signing certificate settings', () => {
    const makeStore = () => observable({
        portConfig: undefined,
        httpProxyPort: 8000,
        http2Enabled: 'fallback',
        http2CurrentlyEnabled: 'fallback',
        tlsInterceptionConfig: { tlsPassthrough: [] },
        currentTlsInterceptionConfig: { tlsPassthrough: [] },
        keyLogFilePath: undefined,
        currentKeyLogFilePath: undefined,
        certificateModes: ['local', 'emudhra', 'emudhra-old'],
        certificateMode: 'local',
        currentCertificateMode: 'local',
        applyCertificateMode: async () => {
            throw new ApiError('unexpected 500', 'POST /config/certificate', 500, {
                message: 'Could not save certificate settings'
            });
        }
    }) as unknown as ProxyStore;

    it('shows the active CA and stages a change before applying', () => {
        const store = makeStore();
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        expect(view.find({ id: 'tls-signing-certificate' }).prop('value')).to.equal('local');
        expect(view.findWhere(n => n.prop('visible') !== undefined).prop('visible')).to.equal(false);
        view.find({ id: 'tls-signing-certificate' }).simulate('change', { target: { value: 'emudhra' } });
        expect(store.certificateMode).to.equal('emudhra');
        expect(store.currentCertificateMode).to.equal('local');
        view.update();
        expect(view.findWhere(n => n.prop('visible') !== undefined).prop('visible')).to.equal(true);
        view.unmount();
    });

    it('offers modern and legacy chains and can stage the legacy choice', () => {
        const store = makeStore();
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        expect(view.find('option[value="emudhra"]').text()).to.contain('modern trust stores');
        expect(view.find('option[value="emudhra-old"]').text()).to.contain('legacy trust stores');
        expect(view.find('option[value="emudhra-old"]').prop('disabled')).to.equal(false);
        view.find({ id: 'tls-signing-certificate' }).simulate('change', { target: { value: 'emudhra-old' } });
        expect(store.certificateMode).to.equal('emudhra-old');
        expect(store.currentCertificateMode).to.equal('local');
        view.unmount();
    });

    it('disables only the legacy choice when a server supports the modern chain alone', () => {
        const store = makeStore();
        store.certificateModes = ['local', 'emudhra'];
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        expect(view.find({ id: 'tls-signing-certificate' }).prop('disabled')).to.equal(false);
        expect(view.find('option[value="emudhra-old"]').prop('disabled')).to.equal(true);
        view.unmount();
    });

    it('still offers restart for other proxy changes when the CA is unchanged', () => {
        const store = makeStore();
        store.http2Enabled = false;
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        expect(store.certificateMode).to.equal(store.currentCertificateMode);
        expect(view.findWhere(n => n.prop('visible') !== undefined).prop('visible')).to.equal(true);
        view.unmount();
    });

    it('hides the setting for older servers', () => {
        const store = makeStore();
        store.certificateModes = [];
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        expect(view.find({ id: 'tls-signing-certificate' }).exists()).to.equal(false);
        expect(view.findWhere(n => n.prop('visible') !== undefined).prop('visible')).to.equal(false);
        view.unmount();
    });

    it('keeps the app open and shows an error if saving fails', async () => {
        const store = makeStore();
        store.certificateMode = 'emudhra';
        const view = shallow(<ProxySettings proxyStore={store} ariaLabel="Proxy settings" />);
        await (view.instance() as any).applySettingsAndReload();
        view.update();
        expect(view.find({ role: 'alert' }).text()).to.contain('Could not save certificate settings');
        expect(view.findWhere(n => n.prop('visible') !== undefined).prop('disabled')).to.equal(false);
        expect(store.currentCertificateMode).to.equal('local');
        view.unmount();
    });
});
