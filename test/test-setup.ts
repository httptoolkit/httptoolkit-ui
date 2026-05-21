import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiDeepMatch from 'chai-deep-match';
import * as chaiEnzyme from 'chai-enzyme';
import { configure as configureMobx } from 'mobx';
chai.use(chaiAsPromised);
chai.use(chaiDeepMatch);
chai.use(chaiEnzyme());

// Match the app's strict-mode config, so tests fail the same way the app does
// (e.g. writes to observed observables outside an action throw).
configureMobx({ enforceActions: 'observed' });

import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

if (Enzyme) {
    // Not defined in node-based (e.g. integration) tests
    Enzyme.configure({ adapter: new Adapter() });
}

export const expect = chai.expect;