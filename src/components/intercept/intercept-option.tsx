import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { Interceptor } from '../../model/interceptors';

import { clickOnEnter } from '../component-utils';
import { LittleCard } from '../common/card';
import { Pill } from '../common/pill';

export interface InterceptOption {
    matches(filter: string): boolean;
}

interface InterceptOptionProps {
    className?: string;
    interceptor: Interceptor;
    onActivate?: (interceptor: Interceptor) => void;
}

const InterceptOptionCard = styled(LittleCard)`
    height: 100%;
    width: 100%;

    user-select: none;

    > svg:first-child {
        position: absolute;
        bottom: -10px;
        right: -10px;
        z-index: 0;
        opacity: 0.2;
    }

    > :not(svg) {
        z-index: 1;
    }

    > p {
        color: ${p => p.theme.mainColor};
    }

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;

const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;

    background-color: rgba(0,0,0,0.2);
    box-shadow: inset 0 2px 10px 0 rgba(0,0,0,0.2);

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StatusPill = styled(Pill)`
    && { margin: auto 0 0 0; }
`;

function getStatusPill(interceptor: Interceptor) {
    if (interceptor.isActive) {
        return <StatusPill color='#4caf7d'>
            Activated
        </StatusPill>;
    } else if (!interceptor.isActivable) {
        if (interceptor.isSupported) {
            return <StatusPill>
                Not available
            </StatusPill>;
        } else {
            return <StatusPill color='#e1421f'>
                Coming soon
            </StatusPill>;
        }
    } else {
        return null;
    }
}

@observer
export class InterceptOption extends React.Component<InterceptOptionProps> {

    constructor(props: InterceptOptionProps) {
        super(props);
    }

    render() {
        const { interceptor, children, className, onActivate } = this.props;

        const isDisabled = !interceptor.isActivable;

        return <div className={className}>
            <InterceptOptionCard
                disabled={isDisabled}
                onKeyDown={clickOnEnter}
                onClick={onActivate ? () => onActivate(interceptor) : undefined}
                tabIndex={!isDisabled && onActivate ? 0 : undefined}
            >
                <FontAwesomeIcon
                    {...interceptor.iconProps}
                    size='8x'
                />

                <h1>{ interceptor.name }</h1>

                { children
                    ? children
                    : <>
                        <p>{ interceptor.description }</p>

                        { getStatusPill(interceptor) }

                        { interceptor.inProgress &&
                            <LoadingOverlay>
                                <FontAwesomeIcon
                                    icon={['fac', 'spinner-arc']}
                                    size='4x'
                                    spin={true}
                                />
                            </LoadingOverlay>
                        }
                    </>
                }
            </InterceptOptionCard>
        </div>
    }

}