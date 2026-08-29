import test from "node:test";
import assert from "node:assert/strict";
import { FIXED_OFFER } from "../schemas/catalog.js";
import { createSellerStub } from "../seller/seller-stub.js";

test("P1: the sole offer remains fixed at USD 150.00 after P2 disclosure wiring", () => {
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });

  assert.deepStrictEqual(FIXED_OFFER, {
    sku: "individual",
    amountMinor: 15000,
    currency: "USD",
    fulfillmentMode: "manual-deferred",
    expectedWindow: "3-5 days",
    resultType: "full chart analysis artifact",
    refundPolicy: "full refund if fulfillment cannot be completed",
    cancellationPolicy: "cancellable before payment confirmation"
  });
  assert.equal(seller.tools[0].execution.taskSupport, "required");
});

test("P1: seller refuses a non-test Stripe secret key", () => {
  assert.throws(
    () => createSellerStub({ stripeSecretKey: "sk_live_not_allowed" }),
    /STRIPE_TEST_MODE_REQUIRED/
  );
});
