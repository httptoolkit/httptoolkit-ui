import * as React from 'react';

import { styled } from '../../styles';

import { Icon } from '../../icons';
import { ModalButton } from './modal-button';
import { AppModal } from '../common/modal';

export const CheckoutSpinner = styled((p: { className?: string, onCancel: () => void }) => (
    <AppModal
        className={p.className}
        aria-label='Waiting for checkout'
    >
        <p>
            The checkout has been opened in your browser.
            <br/>
            Please follow the steps there to complete your subscription.
        </p>
        <p>
            Have questions? Take a look at <a
                href="https://httptoolkit.com/docs/faq/payments/"
            >the FAQ</a> or email <strong>billing@httptoolkit.com</strong>.
        </p>
        <Icon
            icon={['fac', 'spinner-arc']}
            spin
            size='10x'
        />
        <ModalButton onClick={p.onCancel}>
            Cancel checkout
        </ModalButton>
    </AppModal>
))`
    > p {
        max-width: 500px;
        line-height: 1.2;
    }

    > p, > svg {
        color: ${p => p.theme.modalColor};
        margin: 20px auto;
    }

    a[href] {
        color: ${p => p.theme.modalColor};
        font-weight: bold;
        text-decoration: underline;
    }

    text-align: center;
    transform: scale(2);
`;
