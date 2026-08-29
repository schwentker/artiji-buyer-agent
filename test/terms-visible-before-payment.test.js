import test from "node:test";
import assert from "node:assert/strict";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";

test("P2 contract: buyer refuses payment unless material terms were visible before approval", async () => {
  const buyer = new TrueForgeBuyerSession({ sessionId: "disclosure-fixture" });
  const result = await buyer.beginPurchase({
    syntheticSubject: "fixture",
    idempotencyKey: "terms-key-00000000000000001"
  });

  assert.equal(result.paymentAttempted, false);
  assert.equal(result.reason, "MATERIAL_TERMS_INCOMPLETE");
});
