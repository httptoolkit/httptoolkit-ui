import * as React from 'react';
import { observable } from 'mobx';
import { observer } from 'mobx-react';

import { styled } from '../styles';

import { Sidebar } from './sidebar';

import { InterceptPage } from './intercept/intercept-page';
import { WatchPage } from './watch/watch-page';

const PAGES = [
    { name: 'Intercept', icon: ['fas', 'plug'], component: InterceptPage },
    { name: 'Watch', icon: ['fas', 'search'], component: WatchPage }
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

    onSelectPage = (selectedPageIndex: number) => {
        this.selectedPageIndex = selectedPageIndex;
    }
}