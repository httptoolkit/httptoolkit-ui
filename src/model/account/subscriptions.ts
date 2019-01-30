import * as _ from 'lodash';

const PADDLE_VENDOR_ID = 37222;

const waitForPaddle = new Promise<PaddleStatic>((resolve) => {
    const checkForPaddle = () => {
        if (!!(window as any).Paddle) {
            Paddle.Setup({ vendor: PADDLE_VENDOR_ID });
            resolve(Paddle);
        } else {
            setTimeout(checkForPaddle, 500);
        }
    };

    checkForPaddle();
});

async function getPlanPrices(planId: number) {
    const paddle = await waitForPaddle;
    return new Promise<Pricing>((resolve) => {
        paddle.Product.Prices(planId, 1, resolve);
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
    const paddle = await waitForPaddle;

    return new Promise<boolean>((resolve) => {
        paddle.Checkout.open({
            product: SubscriptionPlans[planCode].id,
            email: email,
            disableLogout: true,
            allowQuantity: false,
            successCallback: () => resolve(true),
            closeCallback: () => resolve(false)
        });
    });
}