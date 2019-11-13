import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled, css } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { trackEvent } from '../../tracking';
import { Interceptor } from '../../model/interceptors';
import { InterceptionStore } from '../../model/interception-store';

import { clickOnEnter } from '../component-utils';
import { LittleCard } from '../common/card';
import { Pill } from '../common/pill';
import { CloseButton } from '../common/close-button';

interface InterceptOptionProps {
    className?: string;
    interceptionStore?: InterceptionStore;
    index: number;
    interceptor: Interceptor;
    showRequests: () => void;
}

type InterceptorConfigComponent = React.ComponentType<{
    activateInterceptor: () => Promise<any>,
    showRequests: () => void
}>

export interface InterceptorCustomUiConfig {
    columnWidth: number;
    rowHeight: number;

    configComponent: InterceptorConfigComponent;
    customPill?: React.ComponentType<{}>;
}

const InterceptOptionCard = styled<React.ComponentType<{
    disabled: boolean,
    expanded: boolean,
    index: number,
    uiConfig?: InterceptorCustomUiConfig
} & React.ComponentProps<'section'>>>(LittleCard)`
    height: 100%;
    width: 100%;

    ${p => {
        if (!p.expanded || !p.uiConfig) {
            return `order: ${p.index}`;
        }

        const width = p.uiConfig.columnWidth;
        const height = p.uiConfig.rowHeight;

        // Tweak the order to try and keep cards in the same place as
        // they expand, pushing other cards down rather than moving
        // down in the grid themselves.
        const fixedOrder = Math.max(0, p.index - Math.min(3, width));

        return `
            order: ${fixedOrder}
            grid-row: span ${height};
            grid-column: span ${width};
        `
    }}

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

export const StatusPill = styled(Pill)`
    && { margin: auto 0 0 0; }
`;

function getStatusPill(interceptor: Interceptor) {
    if (interceptor.uiConfig?.customPill) {
        const CustomPill = interceptor.uiConfig?.customPill;
        return <CustomPill />;
    } else if (interceptor.isActive) {
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

@inject('interceptionStore')
@observer
export class InterceptOption extends React.Component<InterceptOptionProps> {

    @observable expanded = false;

    private cardRef = React.createRef<HTMLDivElement>();

    constructor(props: InterceptOptionProps) {
        super(props);

        // Active & configurable components are expanded by default.
        this.expanded = props.interceptor.uiConfig
            ? props.interceptor.isActive
            : false;
    }

    render() {
        const { expanded } = this;
        const { interceptor, index, showRequests } = this.props;

        const isDisabled = !interceptor.isActivable;
        const { uiConfig } = interceptor;
        const ConfigComponent = uiConfig?.configComponent;

        return <InterceptOptionCard
            ref={this.cardRef}

            index={index}
            expanded={expanded}
            uiConfig={uiConfig}

            disabled={isDisabled}
            onKeyDown={clickOnEnter}
            onClick={this.expanded ? undefined : this.onClick}
            tabIndex={!isDisabled && !this.expanded ? 0 : undefined}
        >
            <FontAwesomeIcon
                {...interceptor.iconProps}
                size='8x'
            />

            <h1>{ interceptor.name }</h1>

            { ConfigComponent && expanded
                ? <>
                    <CloseButton onClose={this.onClose} />
                    <ConfigComponent
                        activateInterceptor={this.activateInterceptor}
                        showRequests={showRequests}
                    />
                </>
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
        </InterceptOptionCard>;
    }

    activateInterceptor = () => {
        const { interceptor, interceptionStore } = this.props;
        return interceptionStore!.activateInterceptor(interceptor.id);
    }

    @action.bound
    onClick() {
        const { interceptor, interceptionStore, showRequests } = this.props;

        trackEvent({
            category: 'Interceptors',
            action: 'Activated',
            label: interceptor.id
        });

        if (!interceptor.isActivable) return;

        if (interceptor.uiConfig) {
            this.expanded = true;
            requestAnimationFrame(() => {
                this.cardRef.current?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            });
        } else {
            interceptionStore!.activateInterceptor(interceptor.id)
                .then((successful) => {
                    if (successful) {
                        trackEvent({
                            category: 'Interceptors',
                            action: 'Successfully Activated',
                            label: interceptor.id
                        });

                        showRequests();
                    }
                });
        }
    }

    @action.bound
    onClose() {
        this.expanded = false;
    }

}