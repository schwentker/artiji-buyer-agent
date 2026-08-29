import test from "node:test";
import assert from "node:assert/strict";
import { createSellerStub } from "../seller/seller-stub.js";

test("P3 contract: replaying a logical purchase returns the byte-identical receipt and task without a second PaymentIntent", async () => {
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });
  const request = { merchantId: "seller.local", syntheticSubject: "fixture", idempotencyKey: "replay-key-0000000000000001" };

  const first = await seller.purchase(request);
  const replay = await seller.purchase(request);

  assert.deepStrictEqual(replay.receipt, first.receipt);
  assert.equal(replay.task.taskId, first.task.taskId);
  assert.equal(replay.paymentIntentId, first.paymentIntentId);
  assert.equal(replay.createdPaymentIntents, 1);
});
