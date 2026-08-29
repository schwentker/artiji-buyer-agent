import test from "node:test";
import assert from "node:assert/strict";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";
import { ApprovalGate } from "../buyer/approval-gate.js";
import { COMMERCE_EXTENSION_NAMESPACE } from "../schemas/catalog.js";
import { createSellerStub } from "../seller/seller-stub.js";

test("P2 contract: buyer refuses payment unless material terms were visible before approval", async () => {
  const buyer = new TrueForgeBuyerSession({ sessionId: "disclosure-fixture" });
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });
  const incompleteSeller = {
    ...seller,
    extensions: {
      [COMMERCE_EXTENSION_NAMESPACE]: { ...seller.extensions[COMMERCE_EXTENSION_NAMESPACE] }
    }
  };
  delete incompleteSeller.extensions[COMMERCE_EXTENSION_NAMESPACE].cancellationPolicy;

  const result = await buyer.beginPurchase({
    seller: incompleteSeller,
    syntheticSubject: "fixture",
    idempotencyKey: "terms-key-00000000000000001"
  });

  assert.equal(result.paymentAttempted, false);
  assert.equal(result.approvalRequested, false);
  assert.equal(result.reason, "MATERIAL_TERMS_INCOMPLETE");
  assert.ok(result.missingFields.includes("cancellationPolicy"));
});

test("P2 contract: structured terms are duplicated in the tool description before the approval checkpoint", async () => {
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });
  const buyer = new TrueForgeBuyerSession({ sessionId: "discovery-fixture" });

  const discovery = buyer.inspectOffer(seller);

  assert.equal(discovery.complete, true);
  assert.equal(discovery.descriptionVisible, true);
  assert.deepStrictEqual(discovery.missingFields, []);
});

test("P2 contract: a USD 150 purchase reaches the human approval gate and never pays in P2", async () => {
  const approvals = [];
  const approvalGate = new ApprovalGate({
    requestHumanApproval: async (request) => {
      approvals.push(request);
      return { approved: false, pending: true, source: "trueforge-human-checkpoint" };
    }
  });
  const buyer = new TrueForgeBuyerSession({ sessionId: "approval-fixture", approvalGate });
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture" });

  const result = await buyer.beginPurchase({
    seller,
    syntheticSubject: "fixture",
    idempotencyKey: "approval-key-00000000000000001"
  });

  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].amountMinor, 15000);
  assert.equal(result.termsVisibleBeforePayment, true);
  assert.equal(result.paymentAttempted, false);
  assert.equal(result.reason, "APPROVAL_PENDING");
});
