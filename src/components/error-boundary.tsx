import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { styled } from '../styles';
import { Sentry } from '../errors';
import { isErrorLike } from '../util/error';
import { trackEvent } from '../metrics';

import { Button, ButtonLink } from './common/inputs';

const ErrorOverlay = styled((props: {
    className?: string,
    children: React.ReactNode
}) =>
    <section className={props.className}>
        { props.children }
    </section>
)`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    overflow-y: auto;

    color: ${p => p.theme.mainColor};

    h1 {
        font-size: ${p => p.theme.screamingHeadingSize};
        font-weight: bold;
        margin-bottom: 50px;
    }

    h2 {
        font-size: ${p => p.theme.loudHeadingSize};
        margin-bottom: 50px;
    }

    button, a {
        display: block;
        margin: 40px 40px 0;

        padding: 20px;

        font-size: ${p => p.theme.loudHeadingSize};
        font-weight: bolder;
    }
`;

const ButtonContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
`;

const ErrorOutput = styled.code`
    font-family: ${p => p.theme.monoFontFamily};
    white-space: preserve;
`;

@observer
export class ErrorBoundary extends React.Component<{
    children?: React.ReactNode
}> {

    @observable
    private error: Error | undefined;

    @action
    componentDidCatch(error: Error, errorInfo: any) {
        this.error = error;

        Sentry.withScope(scope => {
            Object.keys(errorInfo).forEach(key => {
                scope.setExtra(key, errorInfo[key]);
            });
            Sentry.captureException(error);
        });

        trackEvent({
            category: 'Error',
            action: 'UI crashed'
        });
    }

    render() {
        return this.error ? (
            <ErrorOverlay>
                <h1>
                    Oh no!
                </h1>
                <h2>
                    Sorry, it's all gone wrong.
                </h2>
                { isErrorLike(this.error) && <ErrorOutput>
                    { this.error.stack ?? this.error.message }
                </ErrorOutput> }
                <ButtonContainer>
                    <ButtonLink href={
                        `https://github.com/httptoolkit/httptoolkit/issues/new?template=bug.yml&title=[UI Crash]%3A+${
                            this.error.message || ''
                        }`
                    }>
                        Tell us what happened
                    </ButtonLink>
                    <Button onClick={() => window.location.reload()}>
                        Reload HTTP Toolkit
                    </Button>
                </ButtonContainer>
            </ErrorOverlay>
        ) : this.props.children;
    }
}