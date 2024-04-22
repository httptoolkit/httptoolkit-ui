import * as _ from 'lodash';
import * as React from 'react';

import { observer } from 'mobx-react';

import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import { Button } from '../../common/inputs';

const SpinnerBlock = styled.div`
    text-align: center;
    flex-grow: 1;
    flex-shrink: 1;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const Spinner = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true,
    size: '2x'
}))`
    display: block;
    margin: 0 auto 10px;
`;

const ListScrollContainer = styled.div`
    overflow-y: auto;
    margin: 10px -15px;
    flex-grow: 1;
    flex-shrink: 1;
`;

const TargetList = styled.ul`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
`;

const Target = styled.li`
    margin-bottom: -10px;
    padding: 10px;

    &:first-child {
        padding-top: 0;
    }

    &:last-child {
        padding-bottom: 0;
        margin-bottom: 0;
    }
`;

const TargetButton = styled(Button)<{
    state: 'active' | 'available' | 'activating' | 'unavailable'
}>`
    font-size: ${p => p.theme.textSize};
    padding: 10px;
    width: 100%;

    display: flex;
    align-items: center;

    ${p => p.state === 'active' &&
        '&& { background-color: #4caf7d; }'
    }

    > svg:first-child {
        margin-right: 10px;
        width: 15px;
    }
`;

const TargetText = styled.span<{ ellipseDirection: 'left' | 'right' }>`
    flex-grow: 1;

    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;

    ${p => p.ellipseDirection === 'left' ?
        'direction: rtl;'
    : ''}
`;

type TargetItem<Id> = {
    id: Id,
    title: string,
    content: React.ReactNode,
    icon?: React.ReactNode,
    status: 'active' | 'available' | 'activating' | 'unavailable',
};

@observer
export class InterceptionTargetList<Id extends string | number> extends React.Component<{
    spinnerText: string,
    targets: TargetItem<Id>[],
    interceptTarget: (id: Id) => void,
    ellipseDirection: 'left' | 'right'
}> {

    render() {
        const { spinnerText, targets, interceptTarget, ellipseDirection } = this.props;

        if (targets.length === 0) {
            return <SpinnerBlock>
                <Spinner />
                { spinnerText }
            </SpinnerBlock>
        }

        return <ListScrollContainer>
            <TargetList>
                { _.map(targets, (target: TargetItem<Id>) => <Target key={target.id}>
                    <TargetButton
                        title={target.title}
                        state={target.status}
                        disabled={target.status !== 'available'}
                        onClick={target.status === 'available'
                            ? () => interceptTarget(target.id)
                            : _.noop
                        }
                    >
                        {
                            target.status === 'activating'
                                ? <Icon icon={['fas', 'spinner']} spin />
                            : target.status === 'active'
                                ? <Icon icon={['fas', 'check']} />
                            : target.icon
                                ? target.icon
                            : null
                        }
                        <TargetText ellipseDirection={ellipseDirection}>
                            { target.content }
                        </TargetText>
                    </TargetButton>
                </Target>) }
            </TargetList>
        </ListScrollContainer>;
    }
}