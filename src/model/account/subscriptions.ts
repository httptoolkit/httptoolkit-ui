import * as _ from 'lodash';

import * as Paddle from 'val-loader!./paddle';

const PADDLE_VENDOR_ID = 37222;
Paddle.Setup({ vendor: PADDLE_VENDOR_ID, enableTracking: false });

async function getPlanPrices(planId: number) {
    return new Promise<Paddle.Pricing>((resolve) => {
        Paddle.Product.Prices(planId, 1, resolve);
    });
}

export interface SubscriptionPlan {
    id: number;
    prices?: {
        monthly: string;
        total: string;
    };
}

export const SubscriptionPlans = {
    'pro-monthly': { id: 550380, name: 'Pro (monthly)' },
    'pro-annual': { id: 550382, name: 'Pro (annual)' },
    'team-monthly': { id: 550789, name: 'Team (monthly)' },
    'team-annual': { id: 550788, name: 'Team (annual)' },
};

async function loadPlanPrices() {
    const response = await fetch(
        `https://accounts.httptoolkit.tech/.netlify/functions/get-prices?product_ids=${
            Object.values(SubscriptionPlans).map(plan => plan.id).join(',')
        }`
    );

    if (!response.ok) {
        console.log(response);
        throw new Error(`Failed to look up prices, got ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
        console.log(data);
        throw new Error("Price lookup request was unsuccessful");
    }

    const productPrices = data.response.products as Array<{
        product_id: number,
        currency: string,
        price: { net: number },
        subscription: { interval: string }
    }>;

    productPrices.forEach((productPrice) => {
        const plan = _.find(SubscriptionPlans,
            { id: productPrice.product_id }
        ) as SubscriptionPlan | undefined;

        if (!plan) return;

        const currency = productPrice.currency;
        const totalPrice = productPrice.price.net;
        const monthlyPrice = productPrice.subscription.interval === 'year'
            ? totalPrice / 12
            : totalPrice;

        plan.prices = {
            total: formatPrice(currency, totalPrice),
            monthly: formatPrice(currency, monthlyPrice)
        };
    });
}
// Async load all plan prices
loadPlanPrices();

function formatPrice(currency: string, price: number) {
    return Number(price).toLocaleString(undefined, {
        style:"currency",
        currency: currency,
        minimumFractionDigits: _.round(price) === price ? 0 : 2,
        maximumFractionDigits: 2
    })
}

export type SubscriptionPlanCode = keyof typeof SubscriptionPlans;

export const getSubscriptionPlanCode = (id: number | undefined) =>
    _.findKey(SubscriptionPlans, { id: id }) as SubscriptionPlanCode | undefined;

export const openCheckout = async (email: string, planCode: SubscriptionPlanCode): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
        Paddle.Checkout.open({
            product: SubscriptionPlans[planCode].id,
            email: email,
            disableLogout: true,
            allowQuantity: false,
            successCallback: () => resolve(true),
            closeCallback: () => resolve(false)
        });
    });
}