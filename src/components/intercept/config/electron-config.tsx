import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';

import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import { logError } from '../../../errors';

import { Interceptor } from '../../../model/interception/interceptors';
import { UiStore } from '../../../model/ui/ui-store';
import { DesktopApi } from '../../../services/desktop-api';

import { uploadFile } from '../../../util/ui';
import { Button, SecondaryButton, UnstyledButton } from '../../common/inputs';

const ConfigContainer = styled.div`
    user-select: text;

    > p {
        line-height: 1.2;

        &:not(:last-child) {
            margin-bottom: 10px;
        }
    }

    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
`;

const Spacer = styled.div`
    flex: 1 1 100%;
`;

const Hr = styled.hr`
    width: 100%;
    margin: 0 0 10px 0;
    border-top: solid 1px ${p => p.theme.containerBorder};
`;

const SelectAndInterceptButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    font-weight: bold;
    padding: 10px 24px;

    width: 100%;
    flex-shrink: 0;

    &:not(:last-child) {
        margin-bottom: 10px;
    }
`;

const RememberedOption = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    &:not(:last-child) {
        margin-bottom: 10px;
    }

    flex-shrink: 0;
`;

const InterceptButton = styled(SecondaryButton)`
    font-size: ${p => p.theme.textSize};
    font-weight: bold;
    padding: 10px 24px;

    width: 100%;
    word-break: break-word;
`;

const ForgetPathButton = styled(UnstyledButton)`
    &:hover {
        opacity: 0.6;
    }
`;

const platform = navigator.platform.startsWith('Mac')
        ? 'mac'
    : navigator.platform.startsWith('Win')
        ? 'win'
    : navigator.platform.includes('Linux')
        ? 'linux'
    : 'unknown';

function getWordForBinary() {
    if (platform === 'mac') return 'application';
    if (platform === 'win') return 'exe';
    if (platform === 'linux') return 'binary';
    else return 'application';
}

function getArticleForBinary(binaryName: string) {
    if (binaryName[0] === 'a' || binaryName[0] === 'e') return 'an';
    else return 'a';
}

function getReadablePath(path: string) {
    if (platform === 'win') {
        // Windows exes generally have meaningful names, so just use that
        return _.last(path.split('\\'))!;
    } else {
        const pathParts = path.split('/').filter(
            p => p !== 'bin' && p !== 'run' // Drop any useless generic bits
        );

        const appPart = _.find(pathParts, p => p.endsWith('.app'));

        if (appPart) {
            // For Mac apps, we drop the (normally invisible) app extension
            return appPart.slice(0, -4);
        } else {
            // Otherwise it's probably a bare binary - we're dropped useless names, so this should work
            return pathParts[pathParts.length - 1];
        }
    }
}

@inject('uiStore')
@observer
class ElectronConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: (options: { pathToApplication: string }) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void,
    uiStore?: UiStore
}> {

    async componentDidMount() {
        const { previousElectronAppPaths } = this.props.uiStore!;
        if (previousElectronAppPaths.length === 0) {
            this.selectApplication();
            // Don't expand for selection, unless we're a mac (where the instructions might be useful).
            if (platform !== 'mac') this.props.closeSelf();
        }
    }

    selectApplication = async () => {
        const appPicker = DesktopApi.selectApplication ?? (() => uploadFile('path'));

        const pathToApplication = await(appPicker());

        if (!pathToApplication) {
            this.props.closeSelf();
            return;
        }

        this.runApplication(pathToApplication)
        .then(() => {
            // Activated successfully! Add it to the list & jump to /view
            this.props.uiStore!.rememberElectronPath(pathToApplication);
        });
    }

    async runApplication(pathToApplication: string) {
        const { activateInterceptor, reportStarted, reportSuccess } = this.props;

        reportStarted(); // 'Started' when you pick an app, not when we ask you to pick one.
        activateInterceptor({ pathToApplication })
        .then(() => {
            reportSuccess();
        }).catch((e) => {
            this.props.uiStore!.forgetElectronPath(pathToApplication);
            logError(e);
        });
    }

    render() {
        const uiStore = this.props.uiStore!;
        const { previousElectronAppPaths, forgetElectronPath } = uiStore;

        const binary = getWordForBinary();
        const binaryArticle = getArticleForBinary(binary);

        return <ConfigContainer>
            <p>
                Start an Electron {binary} with HTTP Toolkit's settings injected,
                to intercept all its HTTP &amp; HTTPS traffic.
            </p>
            {
                platform === 'mac' && previousElectronAppPaths.length < 2 && <p>
                    For .app bundles, you can intercept either the bundle
                    (the .app directory) or the executable itself,
                    typically stored in Contents/MacOS inside the bundle.
                </p>
            }
            <p>
                {
                    previousElectronAppPaths.length
                        ? `You can also rerun a previously started ${binary}, using the buttons below`
                        : `Once you've run ${binaryArticle} ${binary}, it'll be saved and shown here so you can rerun it later`
                }.
            </p>

            <Spacer />

            <SelectAndInterceptButton onClick={this.selectApplication}>
                Select { binaryArticle } { binary }
            </SelectAndInterceptButton>

            { previousElectronAppPaths.length > 0 && <Hr /> }

            { previousElectronAppPaths.map((path) => <RememberedOption key={path}>
                <InterceptButton title={path} onClick={() => this.runApplication(path)}>
                    Start { getReadablePath(path) }
                </InterceptButton>
                <ForgetPathButton onClick={() => forgetElectronPath(path)}>
                    <Icon icon={['fas', 'times']} />
                </ForgetPathButton>
            </RememberedOption>) }
        </ConfigContainer>;
    }

}

export const ElectronCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: ElectronConfig
};
