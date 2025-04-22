import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';

import { NARROW_LAYOUT_BREAKPOINT, styled, popColor, warningColor } from '../../styles';
import { Icon } from '../../icons';
import { trackEvent } from '../../metrics';
import { logError } from '../../errors';
import { windowSize } from '../../util/ui';

import { Interceptor } from '../../model/interception/interceptors';
import { InterceptorStore } from '../../model/interception/interceptor-store';

import { clickOnEnter } from '../component-utils';
import { LittleCard } from '../common/card';
import { Pill } from '../common/pill';
import { CloseButton } from '../common/close-button';
import { DocsLink } from '../common/docs-link';

interface InterceptOptionProps {
    className?: string;
    interceptorStore?: InterceptorStore;
    index: number;
    interceptor: Interceptor;
    showRequests: () => void;
}

type InterceptorConfigComponent = React.ComponentType<{
    interceptor: Interceptor,
    // Custom config UIs should call this to activate the interceptor. This just sends the request,
    // with no side effects except check for updated interceptor state afterwards.
    activateInterceptor: (activationOptions?: any) => Promise<any>,
    // This should be called when each activation is considered started (i.e. after any required
    // user input or confirmation). Id suffix can be specified to distinguish activation types.
    reportStarted: (options?: { idSuffix?: string }) => void,
    // This should be called when each activation is considered successfully completed. If
    // showRequests is not explicitly set to false, it will jump to the View page.
    reportSuccess: (options?: { showRequests?: boolean, idSuffix?: string }) => void,
    // This should be called to hide the custom UI again. Mainly useful if interception is cancelled,
    // or the UI deems itself unnecessary. The UI is never closed automatically, but reportSuccess
    // without showRequests false will jump to the View page, giving similar results.
    closeSelf: () => void
}>

export interface InterceptorCustomUiConfig {
    columnWidth: number;
    rowHeight: number;

    configComponent: InterceptorConfigComponent;
    customPill?: React.ComponentType<{}>;
}

// A function with the same types as a custom config component, but none of the UI:
export type CustomActivationFunction = (
    interceptor: Interceptor,
    activateInterceptor: (activationOptions?: any) => Promise<any>,
    reportStarted: (options?: { idSuffix?: string }) => void,
    reportSuccess: (options?: { showRequests?: boolean, idSuffix?: string }) => void
) => Promise<void>;

const BackgroundIcons = styled.div`
    z-index: 0;

    position: absolute;
    bottom: -10px;
    right: -10px;
    z-index: 0;
    opacity: 0.3;

    > svg {
        &:not(:first-child) {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    }
`;

const InterceptOptionCard = styled(LittleCard)<{
    gridWidth: number,
    disabled: boolean,
    expanded: boolean,
    index: number,
    uiConfig?: InterceptorCustomUiConfig
}>`
    height: 100%;
    width: 100%;
    overflow: hidden;

    ${p => {
        if (!p.expanded || !p.uiConfig) {
            return `order: ${p.index};`;
        }

        const width = Math.min(
            p.uiConfig.columnWidth,
            p.gridWidth
        );
        const height = p.uiConfig.rowHeight;

        // Tweak the order to try and keep cards in the same place as
        // they expand, pushing other cards down rather than moving
        // down in the grid themselves.
        const fixedOrder = Math.max(-1, p.index - width);

        return `
            order: ${fixedOrder};
            grid-row: span ${height};
            grid-column: span ${width};
        `
    }}

    user-select: none;

    > :not(${BackgroundIcons}) {
        z-index: 1;
    }

    > h1:not(:last-child) {
        margin-bottom: 10px; /* Override LittleCard default */
    }

    > p {
        color: ${p => p.theme.mainColor};
        line-height: 1.2;

        &:not(:first-of-type) {
            margin-top: 10px;
        }
    }

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;

const InterceptorTitle = styled.h1<{
    expanded: boolean
}>`
    ${p => p.expanded
        ? 'margin-right: 20px;' // Avoid overlapping the close icon
        : ''
    }
`;

const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;

    background-color: rgba(0,0,0,0.2);
    box-shadow: inset 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StatusPill = styled(Pill)`
    white-space: normal; /* Useful for layout in tiny screens, e.g. the 'proxy port' badge */

    margin-top: auto;
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
                Not available{
                    interceptor.notAvailableHelpUrl
                    ? <DocsLink href={interceptor.notAvailableHelpUrl} />
                    : null
                }
            </StatusPill>;
        } else {
            return <StatusPill color={popColor}>
                Coming soon
            </StatusPill>;
        }
    } else if (interceptor.experimental) {
        return <StatusPill color={warningColor}>
            Experimental
        </StatusPill>;
    } else {
        return null;
    }
}

@inject('interceptorStore')
@observer
export class InterceptOption extends React.Component<InterceptOptionProps> {

    @observable expanded = false;

    private cardRef = React.createRef<HTMLDivElement>();

    constructor(props: InterceptOptionProps) {
        super(props);
    }

    render() {
        const {
            expanded,
            onActivationStarted,
            activateInterceptor,
            onActivationSuccessful
        } = this;
        const { interceptor, index } = this.props;

        const isDisabled = !interceptor.isActivable;
        const { uiConfig } = interceptor;
        const ConfigComponent = uiConfig?.configComponent;

        const icons = _.isArray(interceptor.iconProps)
            ? interceptor.iconProps
            : [interceptor.iconProps];

        const gridWidth = windowSize.width >= NARROW_LAYOUT_BREAKPOINT
            ? 4
            : 3;

        const isExpandable = !!ConfigComponent && !isDisabled;

        return <InterceptOptionCard
            ref={this.cardRef}

            index={index}
            expanded={expanded}
            uiConfig={uiConfig}
            gridWidth={gridWidth}

            data-interceptor-id={interceptor.id}

            role={!this.expanded ? 'button' : 'section'}
            aria-expanded={isExpandable
                ? this.expanded
                : undefined
            }

            disabled={isDisabled}
            onKeyDown={clickOnEnter}
            onClick={this.expanded ? undefined : this.onClick}
            tabIndex={!isDisabled && !this.expanded ? 0 : undefined}
        >
            <BackgroundIcons>
                { icons.map((iconProps, i) =>
                    <Icon
                        key={i}
                        size='8x'
                        {...iconProps}
                    />)
                }
            </BackgroundIcons>

            <InterceptorTitle expanded={expanded}>
                { interceptor.name }
            </InterceptorTitle>

            { ConfigComponent && expanded
                ? <>
                    <CloseButton
                        title="Close this interceptor"
                        onClose={this.onClose}
                    />
                    <ConfigComponent
                        interceptor={interceptor}
                        activateInterceptor={activateInterceptor}
                        reportStarted={onActivationStarted}
                        reportSuccess={onActivationSuccessful}
                        closeSelf={this.onClose}
                    />
                </>
                : <>
                    { interceptor.description.map((descParagraph, i) =>
                        <p key={i}>{ descParagraph }</p>
                    ) }

                    { getStatusPill(interceptor) }

                    { interceptor.inProgress &&
                        <LoadingOverlay>
                            <Icon
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

    onActivationStarted = (options: { idSuffix?: string } = {}) => {
        trackEvent({
            category: 'Interceptors',
            action: 'Activated',
            value: options.idSuffix
                ? `${this.props.interceptor.id}-${options.idSuffix}`
                : this.props.interceptor.id
        });
    };

    activateInterceptor = (activationOptions: unknown = {}) => {
        const { interceptor, interceptorStore } = this.props;
        return interceptorStore!.activateInterceptor(interceptor.id, activationOptions);
    };

    onActivationSuccessful = (options: {
        showRequests?: boolean,
        idSuffix?: string
    } = {}) => {
        trackEvent({
            category: 'Interceptors',
            action: 'Successfully Activated',
            value: options.idSuffix
                ? `${this.props.interceptor.id}-${options.idSuffix}`
                : this.props.interceptor.id
        });

        // Some interceptors don't switch to show the requests, e.g. if the UI shows a list
        // of options to intercept, in case the user wants to select multiple options.
        if (options.showRequests !== false) {
            this.props.showRequests();
        }
    };

    @action.bound
    onClick() {
        const {
            onActivationStarted,
            activateInterceptor,
            onActivationSuccessful
        } = this;
        const { interceptor } = this.props;

        if (interceptor.inProgress) return;

        if (!interceptor.isActivable) {
            // Track that somebody *tried* to activate it
            onActivationStarted();
            return;
        }

        if (interceptor.uiConfig) {
            this.expanded = true;
            requestAnimationFrame(() => {
                this.cardRef.current?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            });
        } else if (interceptor.customActivation) {
            onActivationStarted();
            interceptor.customActivation(
                interceptor,
                this.activateInterceptor,
                onActivationStarted,
                onActivationSuccessful
            ).catch((e) => logError(e));
        } else {
            onActivationStarted();
            activateInterceptor(interceptor.activationOptions)
            .then(() => onActivationSuccessful())
            .catch((e) => logError(e));
        }
    }

    @action.bound
    onClose() {
        this.expanded = false;
    }

}