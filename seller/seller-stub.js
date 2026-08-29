import { COMMERCE_EXTENSION_NAMESPACE, FIXED_OFFER } from "../schemas/catalog.js";
import { assertTestModeStripeKey } from "./config.js";

export function createSellerStub({ stripeSecretKey }) {
  assertTestModeStripeKey(stripeSecretKey);

  return {
    protocolVersion: "2026-07-28",
    extensions: {
      [COMMERCE_EXTENSION_NAMESPACE]: {}
    },
    tools: [{
      name: "order_reading",
      description: "Paid order reading. $125.00 USD; manual deferred fulfillment within 2 business days; returns a signed order-reading artifact; full refund if fulfillment cannot be completed; cancellable before payment confirmation.",
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
