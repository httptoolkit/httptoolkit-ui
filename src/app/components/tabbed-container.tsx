import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { styled } from '../styles';

const Tabs = styled.div`
    display: flex;
`;

const TabButton = styled.button`
    flex: 1;
    padding: 10px;

    border: none;
    border-top: 1px solid ${p => p.theme.containerBorder};

    background-color: ${p => p.theme.popBackground };
    cursor: pointer;

    font-weight: bold;

    &:disabled {
        font-weight: lighter;
        color: #888;
        cursor: not-allowed;
    }

    &.selected {
        border-top: 3px solid ${p => p.theme.popColor};
        padding-top: 8px;
    }
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;

    > :not(${Tabs}) {
        flex: 1;
    }
`;

interface TabbedContainerProps {
    className?: string;
    defaultSelection: string;
    tabNameFormatter?: (key: string) => string;

    children: { [key: string]: React.ReactNode }
}

@observer
export default class TabbedContainer extends React.PureComponent<
    TabbedContainerProps
> {
    @observable selected: string;

    constructor(props: TabbedContainerProps) {
        super(props);
        this.selected = props.defaultSelection;
    }

    render() {
        const {
            children: tabs,
            tabNameFormatter = ((x: string) => x),
            className
        } = this.props;

        const options = Object.keys(tabs);
        const currentTab = tabs[this.selected];

        return <Container className={className}>
            { currentTab }
            <Tabs>
                { options.map((option) => <TabButton
                    key={option}
                    disabled={!tabs[option]}
                    className={option === this.selected ? 'selected' : ''}
                    onClick={() => this.setSelectedTable(option)}
                >
                    {tabNameFormatter(option)}
                </TabButton>) }
            </Tabs>
        </Container>
    }

    @action.bound
    setSelectedTable(option: string) {
        this.selected = option;
    }
}