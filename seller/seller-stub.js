import { COMMERCE_EXTENSION_NAMESPACE, FIXED_OFFER } from "../schemas/catalog.js";
import { assertTestModeStripeKey } from "./config.js";

export function createSellerStub({ stripeSecretKey }) {
  assertTestModeStripeKey(stripeSecretKey);

  return {
    protocolVersion: "2026-07-28",
    extensions: {
      [COMMERCE_EXTENSION_NAMESPACE]: {
        price: { amountMinor: FIXED_OFFER.amountMinor, currency: FIXED_OFFER.currency, display: "$150.00 USD" },
        fulfillmentMode: FIXED_OFFER.fulfillmentMode,
        expectedWindow: FIXED_OFFER.expectedWindow,
        resultType: FIXED_OFFER.resultType,
        refundPolicy: FIXED_OFFER.refundPolicy,
        cancellationPolicy: FIXED_OFFER.cancellationPolicy
      }
    },
    tools: [{
      name: "order_reading",
      description: "Paid individual deep reflection. $150.00 USD; manual-deferred fulfillment in 3-5 days; returns a full chart analysis artifact; full refund if fulfillment cannot be completed; cancellable before payment confirmation.",
      execution: { taskSupport: "required" },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["syntheticSubject", "idempotencyKey"],
        properties: {
          syntheticSubject: { type: "string", minLength: 1 },
          idempotencyKey: { type: "string", minLength: 24 }
        }
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    }],
    offer: FIXED_OFFER,
    async purchase(_request) {
      throw new Error("NOT_IMPLEMENTED: payment and task creation begin in P3");
    }
  };
}
