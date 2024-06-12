import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, flow } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';

import { getDetailedInterceptorMetadata } from '../../../services/server-api';
import { InterceptionTargetList } from './intercept-target-list';

type JvmTarget = { pid: string, name: string, interceptedByProxy: number | undefined };

const JvmTargetList = styled(InterceptionTargetList)`
    max-height: 282px;
`;

@inject('proxyStore')
@observer
class JvmConfig extends React.Component<{
    proxyStore?: ProxyStore,

    interceptor: Interceptor,
    activateInterceptor: (options: { targetPid: string }) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    @observable.shallow
    private jvmTargets: _.Dictionary<JvmTarget> = {};

    updateTargets = flow(function * (this: JvmConfig) {
        const result: {
            jvmTargets?: _.Dictionary<JvmTarget>
        } | undefined = (
            yield getDetailedInterceptorMetadata("attach-jvm")
        );
        this.jvmTargets = result?.jvmTargets ?? {};
    }.bind(this));

    @observable
    private inProgressPids: string[] = [];

    componentDidMount() {
        this.updateTargets();
        const updateInterval = setInterval(this.updateTargets, 2000);
        disposeOnUnmount(this, () => clearInterval(updateInterval));
    }

    render() {
        const interestingTargets = Object.values(this.jvmTargets).filter((target) =>
            // Maven-launched processes have a wrapper, which is never interesting:
            !target.name.startsWith("org.apache.maven.wrapper.MavenWrapperMain ")
        );

        const proxyPort = this.props.proxyStore!.httpProxyPort;

        return <ConfigContainer>
            <p>
                Pick which JVM process you'd like to intercept:
            </p>

            <JvmTargetList
                spinnerText='Looking for JVM processes to intercept...'
                interceptTarget={this.interceptTarget}
                ellipseDirection='left'
                targets={interestingTargets.map((target) => {
                    const activating = this.inProgressPids.includes(target.pid);
                    const alreadyIntercepted = target.interceptedByProxy !== undefined;
                    const interceptedByUs = target.interceptedByProxy === proxyPort;

                    const targetName = target.name.split(' ')[0];

                    const isClassName = !targetName.includes('/') &&
                        !targetName.includes('\\');

                    let contextName: string;
                    let mainName: string;

                    if (isClassName) {
                        const [className, ...packageParts] = targetName.split('.').reverse();
                        const packageName = packageParts.reverse().join('.');

                        contextName = packageName ? packageName + '.' : '';
                        mainName = className;
                    } else {
                        const [filePath, ...dirParts] = targetName.split(/\/|\\/).reverse();
                        const dirPath = dirParts.reverse().join('/');
                        contextName = dirPath ? dirPath + '/' : '';
                        mainName = filePath;
                    }

                    return {
                        id: target.pid,
                        title: target.name,
                        status:
                            activating
                                ? 'activating'
                            : interceptedByUs
                                ? 'active'
                            : alreadyIntercepted
                                ? 'unavailable'
                            : 'available',
                        content: <>
                            <PackageName>{ contextName }</PackageName>
                            <ClassName>{ mainName }</ClassName>
                        </>,
                    };
                })}
            />

            <Footer>
                You can also launch JVM processes from an intercepted
                terminal, where they'll be intercepted automatically.
            </Footer>
        </ConfigContainer>;
    }

    @action.bound
    interceptTarget(pid: string) {
        const {
            inProgressPids,
            props: {
                reportStarted,
                activateInterceptor,
                proxyStore
            }
        } = this;

        reportStarted();
        const activationPromise = activateInterceptor({ targetPid: pid });
        activationPromise.then(() => {
            // Optimistically update the UI's success state
            const target = this.jvmTargets[pid];
            if (target) {
                target.interceptedByProxy = proxyStore!.httpProxyPort;
            }

            this.props.reportSuccess({
                // Don't jump to view, because there's often not immediately visible traffic
                // anyway, and you may well want to intercept multiple targets.
                showRequests: false
            });
        });

        inProgressPids.push(pid);

        activationPromise.finally(action(() => {
            _.pull(inProgressPids, pid);
        }));
    }

}

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

const Footer = styled.p`
    font-size: 85%;
    font-style: italic;
`;

const PackageName = styled.span`
    opacity: 0.6;
`;

const ClassName = styled.span`
    font-weight: bold;
`;

export const JvmCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: JvmConfig
};