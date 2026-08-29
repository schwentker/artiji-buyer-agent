import test from "node:test";
import assert from "node:assert/strict";
import { BuyerStateStore } from "../buyer/state-store.js";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";

test("P3 contract: buyer durably stores the receipt, taskId, idempotency key, and payer material", async (context) => {
  const stateStore = new BuyerStateStore();
  context.after(() => stateStore.close());
  const buyer = new TrueForgeBuyerSession({ sessionId: "paid-session", stateStore });
  const receipt = {
    status: "succeeded",
    method: "stripe",
    timestamp: "2026-08-28T20:00:00.000Z",
    reference: "pi_test_single_payment_intent",
    challengeId: "challenge-fixture"
  };

  await buyer.persistPaidResult({
    idempotencyKey: "replay-key-0000000000000001",
    response: {
      result: {
        resultType: "task",
        taskId: "0123456789012345678901234567890123456789012",
        status: "working",
        createdAt: "2026-08-28T20:00:00.000Z",
        lastUpdatedAt: "2026-08-28T20:00:00.000Z",
        ttlMs: null,
        _meta: { "org.paymentauth/receipt": receipt }
      }
    },
    payerMaterial: { paymentMethod: "pm_card_visa" }
  });
  const stored = await stateStore.load("paid-session");

  assert.equal(stored.idempotencyKey, "replay-key-0000000000000001");
  assert.deepStrictEqual(stored.receipt, receipt);
  assert.equal(stored.taskId, "0123456789012345678901234567890123456789012");
  assert.deepStrictEqual(stored.payerMaterial, { paymentMethod: "pm_card_visa" });
  assert.equal(Number.isNaN(Date.parse(stored.updatedAt)), false);
});
