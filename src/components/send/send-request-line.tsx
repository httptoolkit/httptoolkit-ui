import * as React from 'react';
import { Method } from 'mockttp';

import { styled } from '../../styles';
import { Icon, ArrowIcon } from '../../icons';

import { Button, Select, TextInput } from '../common/inputs';
import { getMethodColor } from '../../model/events/categorization';

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

    &:focus-within > svg {
        color: ${p => p.theme.popColor};
        opacity: 1;
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
`;

export const SendRequestLine = (props: {
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
            placeholder='https://example.com/hello?name=world'

            value={props.url}
            onFocus={prepopulateUrl}
            onChange={updateUrlFromEvent}
        />
        <SendButton
            type='submit'
            disabled={props.isSending}
            title='Send this request'
        >
            { props.isSending
                ? <Icon spin fixedWidth={true} icon={['fas', 'spinner']} />
                : <ArrowIcon direction='right' />
            }
        </SendButton>
    </SendRequestLineContainer>;

};