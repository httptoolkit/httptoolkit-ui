import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, flow } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';

import { Button } from '../../common/inputs';
import { Icon } from '../../../icons';
import { getDetailedInterceptorMetadata } from '../../../services/server-api';

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

type JvmTarget = { pid: string, name: string, interceptedByProxy: number | undefined };

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
            jvmTargets: _.Dictionary<JvmTarget>
        } = (
            yield getDetailedInterceptorMetadata("attach-jvm")
        );
        this.jvmTargets = result.jvmTargets;
    }.bind(this));

    @observable
    private inProgressPids: string[] = [];

    componentDidMount() {
        const updateInterval = setInterval(this.updateTargets, 2000);
        disposeOnUnmount(this, () => clearInterval(updateInterval));
    }

    render() {
        const interestingTargets = Object.values(this.jvmTargets).filter((target) =>
            // Maven-launched processes have a wrapper, which is never interesting:
            !target.name.startsWith("org.apache.maven.wrapper.MavenWrapperMain ")
        );

        const proxyPort = this.props.proxyStore!.serverPort;

        return <ConfigContainer>
            <p>
                Pick which JVM process you'd like to intercept:
            </p>

            { interestingTargets.length === 0
                ? <Spinner />
                : <SelectTargetList
                    targets={interestingTargets}
                    interceptTarget={this.interceptTarget}
                    inProgressPids={this.inProgressPids}
                    ourProxyPort={proxyPort}
                />
            }

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
            onSuccess,
            props: {
                reportStarted,
                activateInterceptor
            }
        } = this;

        reportStarted();
        const activationPromise = activateInterceptor({ targetPid: pid });
        activationPromise.then(onSuccess);

        inProgressPids.push(pid);

        activationPromise.finally(action(() => {
            _.pull(inProgressPids, pid);
        }));
    }

    onSuccess = () => {
        this.props.reportSuccess({
            // Don't jump to view, because there's often not immediately visible traffic
            // anyway, and you may well want to intercept multiple targets.
            showRequests: false
        });
    };

}

const Spinner = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true,
    size: '2x'
}))`
    margin: 0 auto;
`;

const TargetList = styled.ul`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    height: 100%;
`;

const Target = styled.li`
    margin: 0 -15px -10px;
    padding: 10px;
`;

const TargetButton = styled(Button)<{
    state: 'active' | 'available' | 'unavailable'
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

const TargetText = styled.span`
    flex-grow: 1;

    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    direction: rtl;
    text-align: center;
`

const PackageName = styled.span`
    opacity: 0.6;
`;

const ClassName = styled.span`
    font-weight: bold;
`;

@observer
class SelectTargetList extends React.Component<{
    ourProxyPort: number,
    targets: JvmTarget[],
    inProgressPids: string[],
    interceptTarget: (pid: string) => void
}> {

    render() {
        const {
            targets,
            interceptTarget,
            inProgressPids,
            ourProxyPort
        } = this.props;

        return <TargetList>
            { _.map(targets, (target) => {
                const id = target.pid;
                const activating = inProgressPids.includes(id);
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

                const alreadyIntercepted = target.interceptedByProxy !== undefined;
                const interceptedByUs = target.interceptedByProxy === ourProxyPort;

                return <Target key={id}>
                    <TargetButton
                        title={target.name}
                        state={
                            interceptedByUs
                                ? 'active'
                            : alreadyIntercepted
                                ? 'unavailable'
                            : 'available'
                        }
                        disabled={activating || alreadyIntercepted}
                        onClick={activating ? _.noop : () => interceptTarget(id)}
                    >
                        {
                            activating
                                ? <TargetIcon icon={['fas', 'spinner']} spin />
                            : interceptedByUs
                                ? <TargetIcon icon={['fas', 'check']} />
                            : null
                        }
                        <TargetText>
                            &lrm; {/* This disables RTL rendering, but keeps the ellipsis */}
                            <PackageName>{ contextName }</PackageName>
                            <ClassName>{ mainName }</ClassName>
                        </TargetText>
                    </TargetButton>
                </Target>
            }) }
        </TargetList>;
    }
}


export const JvmCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: JvmConfig
};