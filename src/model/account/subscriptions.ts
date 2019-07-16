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

_.map(SubscriptionPlans, async (PlanDetails: SubscriptionPlan) => {
    const planPricing = await getPlanPrices(PlanDetails.id);

    const planPrice = planPricing.price.net.replace(/[\.\,]00/g, '');
    const monthlyPrice = planPricing.recurring.subscription.type === 'year'
        ? planPrice.replace(
            /[\d.,]+$/g,
            (d) => _.round((parseFloat(
                // Replace all punctuation except the last. This ensures we can parse
                // numbers in the 1,000s without assuming either . or , separators.
                d.replace(/[,.](?=\d+[,.])/g, '')
            ) / 12), 2).toString()
        )
        : planPrice;

    PlanDetails.prices = { total: planPrice, monthly: monthlyPrice };
});

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