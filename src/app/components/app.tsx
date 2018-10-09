import * as React from 'react';
import { styled } from '../styles';
import { WatchPage } from './watch-page';
import { Sidebar } from './sidebar';

const Pages = [
    { name: 'Intercept', icon: ['fas', 'plug'], component: WatchPage },
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
        const PageComponent = Pages[this.state.selectedPageIndex].component;

        return <AppContainer>
            <Sidebar
                pages={Pages}
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