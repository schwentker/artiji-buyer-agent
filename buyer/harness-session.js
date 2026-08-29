import { ApprovalGate } from "./approval-gate.js";
import { BuyerStateStore } from "./state-store.js";
import { COMMERCE_EXTENSION_NAMESPACE, REQUIRED_DISCLOSURE_FIELDS } from "../schemas/catalog.js";

/**
 * Adapter boundary for the TrueForge session runtime. The harness runs the
 * model/session; this module owns only commerce-specific persisted state.
 */
export class TrueForgeBuyerSession {
  constructor({ sessionId, stateStore = new BuyerStateStore(), approvalGate = new ApprovalGate() }) {
    this.sessionId = sessionId;
    this.stateStore = stateStore;
    this.approvalGate = approvalGate;
  }

  inspectOffer(seller) {
    const tool = seller?.tools?.find(({ name }) => name === "order_reading");
    const terms = seller?.extensions?.[COMMERCE_EXTENSION_NAMESPACE];
    const missingFields = REQUIRED_DISCLOSURE_FIELDS.filter((field) => !terms?.[field]);
    const description = tool?.description ?? "";
    const normalizedDescription = description.replaceAll("-", " ").toLowerCase();
    const descriptionVisible = REQUIRED_DISCLOSURE_FIELDS.every((field) => {
      const value = terms?.[field];
      if (field === "price") return normalizedDescription.includes(value?.display?.toLowerCase() ?? "");
      return normalizedDescription.includes(String(value ?? "").replaceAll("-", " ").toLowerCase());
    });

    return {
      tool,
      terms,
      missingFields,
      descriptionVisible,
      complete: Boolean(tool) && missingFields.length === 0 && descriptionVisible
    };
  }

  async beginPurchase({ seller, ...request }) {
    const discovery = this.inspectOffer(seller);
    if (!discovery.complete) {
      return {
        paymentAttempted: false,
        approvalRequested: false,
        reason: "MATERIAL_TERMS_INCOMPLETE",
        missingFields: discovery.descriptionVisible ? discovery.missingFields : ["toolDescription", ...discovery.missingFields]
      };
    }

    const approval = await this.approvalGate.request({
      amountMinor: discovery.terms.price.amountMinor,
      currency: discovery.terms.price.currency,
      terms: { ...discovery.terms, sku: seller.offer.sku }
    });

    return {
      paymentAttempted: false,
      approvalRequested: true,
      termsVisibleBeforePayment: true,
      approval,
      reason: approval.approved ? "PAYMENT_DEFERRED_TO_P3" : "APPROVAL_PENDING"
    };
  }

  async persistPaidResult({ idempotencyKey, response, payerMaterial }) {
    const receipt = response?.result?._meta?.["org.paymentauth/receipt"];
    const taskId = response?.result?.taskId;
    if (!receipt || !taskId) throw new Error("INVALID_PAID_RESPONSE");
    return this.stateStore.save(this.sessionId, { idempotencyKey, receipt, taskId, payerMaterial });
  }

  async resumePurchase() {
    throw new Error("NOT_IMPLEMENTED: cold restart resume begins in P4");
  }
}
