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
    'pro-monthly': { id: 550380 },
    'pro-annual': { id: 550382 },
    'team-monthly': { id: 550789 },
    'team-annual': { id: 550788 },
};

_.map(SubscriptionPlans, async (PlanDetails: SubscriptionPlan) => {
    const planPricing = await getPlanPrices(PlanDetails.id);

    const planPrice = planPricing.price.net.replace(/[\.\,]00/g, '');
    const monthlyPrice = planPricing.recurring.subscription.type === 'year' ?
        planPrice.replace(/[\d\.\,]+/g, (d) => _.round((parseFloat(d) / 12), 2).toString()) : planPrice;

    PlanDetails.prices = { total: planPrice, monthly: monthlyPrice };
});

export type SubscriptionPlanCode = keyof typeof SubscriptionPlans;

export const getSubscriptionPlanCode = (id: number) =>
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