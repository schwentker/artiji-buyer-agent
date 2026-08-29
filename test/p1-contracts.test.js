import test from "node:test";
import assert from "node:assert/strict";
import { COMMERCE_EXTENSION_NAMESPACE, FIXED_OFFER } from "../schemas/catalog.js";
import { createSellerStub } from "../seller/seller-stub.js";

test("P1: the sole offer is fixed at USD 125.00 and the commerce extension is empty", () => {
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });

  assert.deepStrictEqual(FIXED_OFFER, {
    sku: "order-reading-125",
    amountMinor: 12500,
    currency: "USD",
    fulfillmentMode: "manual-deferred",
    expectedWindow: "within 2 business days",
    resultType: "signed order-reading artifact",
    refundPolicy: "full refund if fulfillment cannot be completed",
    cancellationPolicy: "cancellable before payment confirmation"
  });
  assert.deepStrictEqual(seller.extensions[COMMERCE_EXTENSION_NAMESPACE], {});
  assert.equal(seller.tools[0].execution.taskSupport, "required");
});

test("P1: seller refuses a non-test Stripe secret key", () => {
  assert.throws(
    () => createSellerStub({ stripeSecretKey: "sk_live_not_allowed" }),
    /STRIPE_TEST_MODE_REQUIRED/
  );
});
