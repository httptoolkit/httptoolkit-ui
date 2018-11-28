import * as React from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';

import { styled } from '../styles';

import { Sidebar } from './sidebar';

import { InterceptPage } from './intercept/intercept-page';
import { ViewPage } from './view/view-page';

const PAGES = [
    { name: 'Intercept', icon: ['fas', 'plug'], component: InterceptPage },
    { name: 'View', icon: ['fas', 'search'], component: ViewPage }
];

const AppContainer = styled.div`
    display: flex;

    > :not(${Sidebar}) {
        flex: 1 1;
    }
`;

@observer
export class App extends React.Component {

    @observable selectedPageIndex: number = 0;

    render() {
        const PageComponent = PAGES[this.selectedPageIndex].component;

        return <AppContainer>
            <Sidebar
                pages={PAGES}
                selectedPageIndex={this.selectedPageIndex}
                onSelectPage={this.onSelectPage}
            />
            <PageComponent />
        </AppContainer>
    }

    @action.bound
    onSelectPage(selectedPageIndex: number) {
        this.selectedPageIndex = selectedPageIndex;
    }
}