import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiDeepMatch from 'chai-deep-match';
import * as chaiEnzyme from 'chai-enzyme';
chai.use(chaiAsPromised);
chai.use(chaiDeepMatch);
chai.use(chaiEnzyme());

import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

if (Enzyme) {
    // Not defined in node-based (e.g. integration) tests
    Enzyme.configure({ adapter: new Adapter() });
}

export const expect = chai.expect;