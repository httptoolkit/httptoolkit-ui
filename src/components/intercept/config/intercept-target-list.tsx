import * as _ from 'lodash';
import * as React from 'react';

import { observer } from 'mobx-react';

import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import { Button } from '../../common/inputs';

const SpinnerBlock = styled.div`
    text-align: center;
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
    max-height: 279px;
    overflow-y: auto;
    margin: 10px -15px;
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
`;

const TargetIcon = styled(Icon)`
    margin-right: 10px;
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
    status: 'active' | 'available' | 'activating' | 'unavailable',
};

@observer
export class InterceptionTargetList<Id extends string | number> extends React.Component<{
    targetName: string,
    targets: TargetItem<Id>[],
    interceptTarget: (id: Id) => void,
    ellipseDirection: 'left' | 'right'
}> {

    render() {
        const { targetName, targets, interceptTarget, ellipseDirection } = this.props;

        if (targets.length === 0) {
            return <SpinnerBlock>
                <Spinner />
                Looking for running { targetName } to intercept...
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
                                ? <TargetIcon icon={['fas', 'spinner']} spin />
                            : target.status === 'active'
                                ? <TargetIcon icon={['fas', 'check']} />
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