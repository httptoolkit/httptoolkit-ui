import * as React from 'react';
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

export const App = styled(class App extends React.PureComponent<
    {},
    { selectedPageIndex: number }
> {
    constructor(props: {}) {
        super(props);

        this.state = {
            selectedPageIndex: 0
        }
    }

    render() {
        const PageComponent = PAGES[this.state.selectedPageIndex].component;

        return <AppContainer>
            <Sidebar
                pages={PAGES}
                selectedPageIndex={this.state.selectedPageIndex}
                onSelectPage={this.onSelectPage}
            />
            <PageComponent />
        </AppContainer>
    }

    onSelectPage = (selectedPageIndex: number) => {
        this.setState({ selectedPageIndex });
    }
})`
`;