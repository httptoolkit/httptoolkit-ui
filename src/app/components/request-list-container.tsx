import { connect } from 'react-redux'
import { RequestList } from './request-list';
import { MockttpRequest } from '../types';
import { StoreModel } from '../store';

export const RequestListContainer = connect(
    (state: StoreModel) => ({
        requests: state.requests
    })
)(RequestList);