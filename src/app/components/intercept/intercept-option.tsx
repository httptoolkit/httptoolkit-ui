import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled, FontAwesomeIcon } from '../../styles';
import { LittleCard } from '../card';
import { InterceptorUIConfig } from './intercept-page';

export interface InterceptOption {
    matches(filter: string): boolean;
}

interface InterceptOptionProps {
    interceptor: InterceptorUIConfig;
    disabled: boolean;
    onActivate: (interceptor: InterceptorUIConfig) => void;
}

const InterceptOptionCard = styled(LittleCard)`
    height: 100%;
    width: 100%;

    user-select: none;

    > svg {
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
`;

const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(0,0,0,0.2);

    display: flex;
    align-items: center;
    justify-content: center;
`;

@observer
export class InterceptOption extends React.Component<InterceptOptionProps> {

    constructor(props: InterceptOptionProps) {
        super(props);
    }

    render() {
        return <InterceptOptionCard
            disabled={this.props.disabled}
            onKeyDown={this.onInterceptKeyDown.bind(this)}
            onClick={this.onInterceptorClicked.bind(this)}
            key={this.props.interceptor.name}
            tabIndex={0}
        >
            <FontAwesomeIcon
                {...this.props.interceptor.iconProps}
                size='8x'
            />

            <h1>{ this.props.interceptor.name }</h1>
            <p>{ this.props.interceptor.description }</p>

            { this.props.interceptor.inProgress &&
                <LoadingOverlay>
                    <FontAwesomeIcon
                        icon={['far', 'spinner-third']}
                        size='4x'
                        spin={true}
                    />
                </LoadingOverlay>
            }
        </InterceptOptionCard>
    }

    async onInterceptorClicked() {
        this.props.onActivate(this.props.interceptor);
    }

    onInterceptKeyDown(event: React.KeyboardEvent) {
        if (event.key === 'Enter') {
            this.props.onActivate(this.props.interceptor);
        }
    }

}