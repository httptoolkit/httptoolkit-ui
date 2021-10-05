import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { styled } from '../styles';
import { Sentry, isSentryInitialized } from '../errors';
import { trackEvent } from '../tracking';

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

    color: ${p => p.theme.mainColor};

    h1 {
        font-size: 300px;
        font-weight: bold;
        line-height: 230px;
        margin-bottom: 50px;
    }

    p {
        font-size: 50px;
        margin-bottom: 50px;
    }

    button {
        display: block;
        margin: 0 auto 40px;

        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
        box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);
        border-radius: 4px;
        border: none;

        padding: 20px;

        font-size: 50px;
        font-weight: bolder;

        &:not(:disabled) {
            cursor: pointer;

            &:hover {
                color: ${p => p.theme.popColor};
            }
        }
    }
`;

@observer
export class ErrorBoundary extends React.Component {

    @observable
    private error: Error | undefined;

    @observable
    private feedbackSent: boolean = false;

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
                <p>
                    Sorry, it's all gone wrong.
                </p>
                <div>
                    { isSentryInitialized() &&
                        <button disabled={this.feedbackSent} onClick={this.sendFeedback}>
                            Tell us what happened
                        </button>
                    }
                    <button onClick={() => window.location.reload()}>
                        Reload HTTP Toolkit
                    </button>
                </div>
            </ErrorOverlay>
        ) : this.props.children;
    }

    @action.bound
    sendFeedback() {
        Sentry.showReportDialog();
        this.feedbackSent = true;
    }
}