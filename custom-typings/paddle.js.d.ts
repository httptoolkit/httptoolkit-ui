interface Pricing {
    country: string;
    price: {
        gross: string;
        net: string;
        tax: string;
        tax_included: boolean;
    };
    recurring: {
        subscription: {
            type: 'year' | 'month';
        };
    };
}

interface PaddleStatic {
    Setup(options: {
        vendor: number;
        enableTracking?: boolean;
    }): void;

    Product: {
        Prices(productId: number, quantity: number, callback: (pricing: Pricing) => void): void;
    };

    Checkout: {
        open(options: {
            product: number,
            email?: string,
            disableLogout?: boolean,
            allowQuantity?: boolean,
            successCallback?: () => void,
            closeCallback?: () => void

            upsell?: number,
            upsellTitle?: string,
            upsellText?: string,
            upsellAction?: string
        }): void;
    }
}

declare const Paddle: PaddleStatic;