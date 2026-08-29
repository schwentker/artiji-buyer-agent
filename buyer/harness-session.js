import { ApprovalGate } from "./approval-gate.js";
import { BuyerStateStore } from "./state-store.js";
import { COMMERCE_EXTENSION_NAMESPACE, REQUIRED_DISCLOSURE_FIELDS } from "../schemas/catalog.js";
import { canonicalJson } from "../shared/canonical.js";

const TASK_STATUSES = new Set(["working", "input_required", "completed", "failed", "cancelled"]);

function assertTaskShape(task, resultType) {
  const validTtl = task?.ttlMs === null || (Number.isInteger(task?.ttlMs) && task.ttlMs >= 0);
  if (
    task?.resultType !== resultType ||
    typeof task.taskId !== "string" || task.taskId.length < 32 ||
    !TASK_STATUSES.has(task.status) ||
    Number.isNaN(Date.parse(task.createdAt)) ||
    Number.isNaN(Date.parse(task.lastUpdatedAt)) ||
    !validTtl
  ) {
    throw new Error("INVALID_TASK_RESPONSE");
  }
}

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
    assertTaskShape(response.result, "task");
    return this.stateStore.save(this.sessionId, { idempotencyKey, receipt, taskId, payerMaterial });
  }

  async resumePurchase({
    getTask,
    maxPolls = 100,
    waitForWakeHint = async () => new Promise((resolve) => setTimeout(resolve, 100))
  }) {
    const persisted = await this.stateStore.load(this.sessionId);
    if (!persisted) throw new Error("PERSISTED_PURCHASE_NOT_FOUND");

    for (let pollCount = 1; pollCount <= maxPolls; pollCount += 1) {
      const response = await getTask(persisted.taskId);
      const task = response?.result;
      if (!task || task.taskId !== persisted.taskId) throw new Error("TASK_CORRELATION_MISMATCH");
      assertTaskShape(task, "complete");
      const receipt = task._meta?.["org.paymentauth/receipt"];
      if (canonicalJson(receipt) !== canonicalJson(persisted.receipt)) {
        throw new Error("RECEIPT_CORRELATION_MISMATCH");
      }

      if (task.status === "completed") {
        const artifact = task.result?.structuredContent?.artifact;
        const matchingResource = task.result?.content?.some((content) => (
          content.type === "resource_link" && content.uri === artifact?.url
        ));
        if (!artifact?.id || !artifact?.url || !matchingResource) {
          throw new Error("COMPLETED_TASK_MISSING_ARTIFACT");
        }
        if (artifact.orderReference !== persisted.receipt.reference) {
          throw new Error("ARTIFACT_ORDER_MISMATCH");
        }
        return {
          resumedFromPersistence: true,
          authoritativeSource: "tasks/get",
          notificationsAuthoritative: false,
          pollCount,
          receipt,
          artifact
        };
      }
      if (["failed", "cancelled"].includes(task.status)) throw new Error(`TASK_${task.status.toUpperCase()}`);
      await waitForWakeHint({ taskId: persisted.taskId, pollCount });
    }
    throw new Error("TASK_POLL_TIMEOUT");
  }
}
