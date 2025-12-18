import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';

import { asErrorLike } from '@httptoolkit/util';
import { sendAuthCode, loginWithCode } from '@httptoolkit/accounts';

import { styled, keyframes } from '../../styles';
import { Icon } from '../../icons';
import Logo from '../../images/logo-icon.svg';

import { AccountStore } from '../../model/account/account-store';
import { CloseButton } from '../common/close-button';

const Modal = styled.dialog`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    margin: 0;

    width: auto;
    max-width: 340px;

    width: auto;
    max-width: 340px;

    background: white;
    color: black;

    border-radius: 16px;
    padding: 0;
    box-shadow: 0 0 0 1px ${p => p.theme.containerBorder} inset;

    outline: none;
    border: none;

    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};

    line-height: 1.5;
`;

const CtaButton = styled.button`
    margin: 20px;
    width: calc(100% - 40px);
    min-height: 58px;

    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.subHeadingSize};
    font-weight: bold;
    line-height: 1;

    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;

    background: linear-gradient(to bottom, #F65430, #D93815);
    border: 1px solid ${p => p.theme.popColor};
    color: ${p => p.theme.popOverlayColor};
    border-radius: 12px;

    &:hover:not([disabled]) {
        border: 1px solid ${p => p.theme.mainColor};
        transition: all ease-in 0.3s;
        background: linear-gradient(to bottom, #F65430, #D93815);
    }

    padding: 19px 24px;
    box-shadow:
        rgba(255, 255, 255, 0.15) 0px 2px 1px 0px inset,
        rgba(0, 0, 0, 0.05) 0px -2px 2px 0px inset;
`;

const BackButton = styled.button`
    position: absolute;
    top: 0;
    left: 0;
    padding: 16px;

    background: none;
    border: none;
    color: ${p => p.theme.mainColor};
    cursor: pointer;

    &:hover {
        color: ${p => p.theme.mainLowlightColor};
    }

    > svg {
        width: 20px;
        height: 20px;
    }
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`

const HeadingLogo = styled.img.attrs(() => ({
    src: Logo
}))`
    margin: 48px 16px 16px;
    width: 30%;
    fill: var(--cinnabar-red);
`;

const Title = styled.h2`
    margin: 16px 32px;
    text-align: center;
    font-size: ${({ theme }) => theme.largeHeadingSize};
    line-height: 1.2;
`;

const Subtitle = styled.h3`
    margin: -10px 32px 16px;
    text-align: center;
`;

const Email = styled.span`
    white-space: break-spaces;
    word-break: break-word;
    hyphens: auto;
`;

const Input = styled.input`
    padding: 16px;
    margin: 16px 0 0;
    width: 100%;

    border-style: solid;
    color: ${p => p.theme.inputColor};
    border-color: ${p => p.theme.inputBorder};
    background-color: ${p => p.theme.inputBackground};

    border-width: 1px 0 1px 0;
    z-index: 1;

    font-size: ${({ theme }) => theme.textSize};

    &:focus {
        border-color: ${p => p.theme.inputColor};
    }
`;

const CodeInput = styled(Input)`
    :not(:placeholder-shown) {
        letter-spacing: 4px;
    }

    text-align: center;
`;

const SmallPrint = styled.p`
    margin: 0;
    padding: 10px 16px 12px;
    width: 100%;

    font-size: ${({ theme }) => theme.smallPrintSize};
    font-style: italic;

    background-color: ${p => p.theme.mainLowlightBackground};
    color: ${p => p.theme.mainColor};

    a {
        color: ${p => p.theme.mainColor};
        text-decoration: underline;

        &:hover {
            color: ${p => p.theme.mainLowlightColor};
        }
    }
`;

const spin = keyframes`
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
`;

const Spinner = styled.div`
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top: 4px solid ${p => p.theme.popOverlayColor};
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: ${spin} 1s linear infinite;
    margin: -4px 0;
`;

const ErrorMessage = styled.div`
    color: red;
    margin: 16px 20px 0;
`;

export const LoginModal = observer(({ accountStore }: { accountStore: AccountStore }) => {
    const handleDialogClose = React.useCallback(() => {
        accountStore.cancelLogin();
    }, []);

    return <Modal
        ref={(dialog) => dialog?.showModal()}
    >
        <CloseButton onClose={handleDialogClose} />
        <LoginFields accountStore={accountStore} />
    </Modal>;
});

const focusInput = (input: HTMLInputElement | null) => {
    requestAnimationFrame(() =>
        input?.focus()
    );
}

const LoginFields = ({ accountStore }: { accountStore: AccountStore }) => {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');

    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | false>(false);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsLoading(true);
        setError(false);

        try {
            await sendAuthCode(email, 'website');
            setIsLoading(false);
            setIsEmailSent(true);
        } catch (e) {
            setIsLoading(false);
            setError(asErrorLike(e).message || 'An error occurred');
        }
    };

    const handleBackButton = () => {
        setIsEmailSent(false);
        setError(false);
        setCode('');
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsLoading(true);
        setError(false);

        try {
            await loginWithCode(email, code);
            await accountStore.finalizeLogin(email);
            // We never unset isLoading - the modal disappears entirely when the
            // account store state is fully updated, and we want to spin till then.
        } catch (e) {
            setIsLoading(false);
            setError(asErrorLike(e).message || 'An error occurred');
        }
    };

    const smallPrint = (
        <SmallPrint>
            By creating an account you accept the <a
                href="https://httptoolkit.com/terms-of-service/"
                target="_blank"
            >
                Terms of Service
            </a> and <a
                href="https://httptoolkit.com/privacy-policy/"
                target="_blank"
            >
                Privacy Policy
            </a>.
        </SmallPrint>
    );

    return !isEmailSent
        ? <Form onSubmit={handleEmailSubmit}>
            <HeadingLogo />
            <Title>
                Enter your email
            </Title>
            <Input
                name="email"
                type="email"
                required
                placeholder="you@email.example"
                ref={focusInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
            />

            {error &&
                <ErrorMessage>{error}</ErrorMessage>
            }

            <CtaButton type="submit" disabled={isLoading}>
                {isLoading ? <Spinner /> : 'Send Code'}
            </CtaButton>

            { smallPrint }
        </Form>
        :
        <Form onSubmit={handleCodeSubmit}>
            <BackButton
                type="button"
                onClick={handleBackButton}
                aria-label="Go back"
            >
                <Icon icon={['fas', 'arrow-left']} size='2x' />
            </BackButton>
            <HeadingLogo />
            <Title>
                Enter the code
            </Title>
            <Subtitle>
                sent to you at<br /><Email>
                    {email}
                </Email>
            </Subtitle>
            <CodeInput
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                required
                placeholder="Enter the 6 digit code"
                ref={focusInput}
                value={code}
                onChange={(e) => {
                    const input = e.target.value;
                    const numberInput = input.replace(/\D/g, '').slice(0, 6);
                    setCode(numberInput);
                }}
                disabled={isLoading}
            />

            {error &&
                <ErrorMessage>{error}</ErrorMessage>
            }

            <CtaButton type="submit" disabled={isLoading}>
                {isLoading ? <Spinner /> : 'Login'}
            </CtaButton>

            { smallPrint }
        </Form>
};
