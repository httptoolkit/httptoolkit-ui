import * as React from 'react';
import { Method } from 'mockttp';
import * as HarFormat from 'har-format';
import { parseCurlCommand } from 'curl-as-har-request';

import { styled } from '../../styles';
import { Icon, ArrowIcon } from '../../icons';

import { getMethodColor } from '../../model/events/categorization';

import { Ctrl } from '../../util/ui';
import { Button, Select, TextInput } from '../common/inputs';

type MethodName = keyof typeof Method;
const validMethods = Object.values(Method)
    .filter(
        value => typeof value === 'string'
    ) as Array<MethodName>;

const SendRequestLineContainer = styled.form`
    background-color: ${p => p.theme.mainBackground};
    flex-grow: 0;
    display: flex;

    z-index: 1;
    box-shadow: 0 2px 3px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
`;

const MethodSelectArrow = styled(Icon).attrs(() => ({
    icon: ['fas', 'chevron-down']
}))`
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);

    color: ${p => p.theme.mainColor};
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-size: ${p => p.theme.textInputFontSize};

    pointer-events: none;
`;

const MethodSelect = styled(Select)`
    border-radius: 0;
    border: none;
    outline: none;
    appearance: none;

    border-left: 5px solid ${(p: { borderColor: string }) => p.borderColor};

    padding: 5px 0 5px 15px;
    font-size: ${p => p.theme.textInputFontSize};

    height: 100%;
    width: 100%;

    color: ${p => p.theme.mainColor};
    background-color: ${p => p.theme.mainLowlightBackground};
`;

const MethodSelectContainer = styled.div`
    position: relative;
    font-size: ${p => p.theme.textSize};

    flex-shrink: 0;
    flex-grow: 0;
    flex-basis: 105px;

    &:focus-within {
        > svg {
            color: ${p => p.theme.popColor};
            opacity: 1;
        }

        > select {
            font-weight: bold;
        }
    }
`;

const UrlInput = styled(TextInput)`
    flex-basis: 100%;
    flex-grow: 1;

    border-radius: 0;
    border: none;

    padding: 10px 10px 10px;

    font-size: ${p => p.theme.textSize};

    &:focus {
        outline: none;
    }
`;

const SendButton = styled(Button)`
    padding: 4px 18px 5px;
    border-radius: 0;

    font-size: ${p => p.theme.textSize};

    > svg {
        padding: 0;
    }

    &:focus {
        outline: none;
        background-color: ${p => p.theme.popColor};
    }
`;

export const SendRequestLine = (props: {
    updateFromHar: (harRequest: HarFormat.Request) => void;

    method: string;
    updateMethod: (method: string) => void;

    url: string;
    updateUrl: (url: string) => void;

    isSending: boolean;
    sendRequest: () => void;
}) => {
    const updateMethodFromEvent = React.useCallback((changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        props.updateMethod(changeEvent.target.value);
    }, [props.updateMethod]);

    const updateUrlFromEvent = React.useCallback((changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        props.updateUrl(changeEvent.target.value);
    }, [props.updateUrl]);

    const prepopulateUrl = React.useCallback((focusEvent: React.FocusEvent<HTMLInputElement>) => {
        const inputField = focusEvent.target;
        if (!inputField.value) inputField.value = 'https://';
    }, []);

    const sendRequest = React.useCallback((event: React.SyntheticEvent<HTMLElement>) => {
        event.preventDefault();
        props.sendRequest();
        return false;
    }, [props.sendRequest]);

    const onPaste = React.useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = event.clipboardData.getData('text/plain');
        if (pastedText.match(/^\s*curl /)) {
            event.preventDefault();

            // Looks like you've pasted a curl command, try to parse it to HAR, then
            // generate a request from there:
            try {
                // For now we use the first command, we could pop into multiple tabs if
                // we want to support multiple commands here later:
                const harRequest = parseCurlCommand(pastedText)[0];
                if (!harRequest.url) {
                    throw new Error('Could not extract URL from pasted curl command.');
                }
                props.updateFromHar(harRequest);
            } catch (e: any) {
                console.log(e);
                alert(`Could not parse pasted curl command:\n\n${e.message || e}`);
            }
        }
    }, [props.updateFromHar]);

    const borderColor = getMethodColor(props.method);

    return <SendRequestLineContainer
        className='ignores-expanded' // This always shows, even if something is expanded
        onSubmit={sendRequest}
    >
        <MethodSelectContainer>
            <MethodSelect
                value={props.method}
                onChange={updateMethodFromEvent}
                borderColor={borderColor}
            >
                { validMethods.map((methodOption) =>
                    <option
                        key={methodOption}
                        value={methodOption}
                    >
                        { methodOption }
                    </option>
                ) }
            </MethodSelect>
            <MethodSelectArrow />
        </MethodSelectContainer>
        <UrlInput
            type='url'
            spellCheck='false'
            placeholder='https://example.com/hello?name=world or paste a cURL command'
            required={true}

            value={props.url}
            onFocus={prepopulateUrl}
            onChange={updateUrlFromEvent}
            onPaste={onPaste}
        />
        <SendButton
            type='submit'
            disabled={props.isSending}
            title={`Send this request (${Ctrl}+Enter)`}
        >
            { props.isSending
                ? <Icon spin fixedWidth={true} icon={['fas', 'spinner']} />
                : <ArrowIcon direction='right' />
            }
        </SendButton>
    </SendRequestLineContainer>;

};