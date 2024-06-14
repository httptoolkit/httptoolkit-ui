import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, flow } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';

import { getDetailedInterceptorMetadata } from '../../../services/server-api';

import { InterceptionTargetList } from './intercept-target-list';

const ConfigContainer = styled.div`
    user-select: text;

    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    > p {
        line-height: 1.2;

        &:not(:last-child) {
            margin-bottom: 5px;
        }

        &:not(:first-child) {
            margin-top: 5px;
        }
    }

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

const DockerTargetList = styled(InterceptionTargetList)`
    max-height: 262px;
`;

const Footer = styled.p`
    font-size: 85%;
    font-style: italic;
`;

type ContainerTarget = {
    id: string,
    names: string[],
    labels: { [key: string]: string },
    image: string
};

const CONTAINER_PROXY_LABEL = "tech.httptoolkit.docker.proxy";

@inject('proxyStore')
@observer
class DockerAttachConfig extends React.Component<{
    proxyStore?: ProxyStore,

    interceptor: Interceptor,
    activateInterceptor: (options: { containerId: string }) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    @observable.shallow
    private targets: _.Dictionary<ContainerTarget> = {};

    updateTargets = flow(function * (this: DockerAttachConfig) {
        const result: {
            targets?: _.Dictionary<ContainerTarget>
        } | undefined = (
            yield getDetailedInterceptorMetadata("docker-attach")
        );
        this.targets = result?.targets ?? {};
    }.bind(this));

    @observable
    private inProgressIds: string[] = [];

    componentDidMount() {
        this.updateTargets();
        const updateInterval = setInterval(this.updateTargets, 2000);
        disposeOnUnmount(this, () => clearInterval(updateInterval));
    }

    render() {
        const proxyPort = this.props.proxyStore!.httpProxyPort;
        const targets = Object.values(this.targets)
            .filter(target =>
                !target.image.startsWith('httptoolkit/docker-socks-tunnel')
            );

        return <ConfigContainer>
            <p>
                Pick a container to restart it with all traffic intercepted:
            </p>

            <DockerTargetList
                spinnerText='Looking for Docker containers to intercept...'
                interceptTarget={this.interceptTarget}
                ellipseDirection='left'
                targets={targets.map((target) => {
                    const activating = this.inProgressIds.includes(target.id);
                    const interceptedByUs = target.labels[CONTAINER_PROXY_LABEL] === proxyPort.toString();

                    // Container names are more or less alphanumeric, but internally have a normally
                    // hidden slash: https://github.com/moby/moby/issues/6705. We hide that too.
                    const containerName = target.names[0]?.replace(/^\//, '') || target.id.slice(0, 8);

                    const containerDescription = target.id.startsWith(containerName)
                        ? `'${containerName}'`
                        : `'${containerName}' (${target.id.slice(0, 8)})`

                    return {
                        id: target.id,
                        title: `Container ${containerDescription}, from image '${target.image}'`,
                        status:
                            activating
                                ? 'activating'
                            : interceptedByUs
                                ? 'active'
                            : 'available', // <-- We allow intercepting containers already intercepted elsewhere
                        content: <>
                            <ContainerName>{ containerName }</ContainerName>
                            <ImageName>{ target.image }</ImageName>
                        </>,
                    };
                })}
            />

            <Footer>
                You can also create Docker containers from an intercepted
                terminal, where they'll be intercepted automatically.
            </Footer>
        </ConfigContainer>;
    }

    @action.bound
    interceptTarget(containerId: string) {
        const {
            inProgressIds,
            props: {
                reportStarted,
                activateInterceptor,
                proxyStore
            }
        } = this;

        reportStarted();
        const activationPromise = activateInterceptor({ containerId: containerId });
        activationPromise.then(() => {
            // Optimistically update the UI's success state
            const target = this.targets[containerId];
            if (target) {
                target.labels[CONTAINER_PROXY_LABEL] = proxyStore!.httpProxyPort.toString();
            }

            this.props.reportSuccess({
                // Don't jump to view, because there's often not immediately visible traffic
                // anyway, and you may well want to intercept multiple targets.
                showRequests: false
            });
        });

        inProgressIds.push(containerId);

        activationPromise.finally(action(() => {
            _.pull(inProgressIds, containerId);
        }));
    }

}

const ContainerName = styled.div`
    font-weight: bold;
`;

const ImageName = styled.div`
    opacity: 0.6;
`;


export const DockerAttachCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: DockerAttachConfig
};