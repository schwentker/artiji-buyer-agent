import { ApprovalGate } from "./approval-gate.js";
import { BuyerStateStore } from "./state-store.js";

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

  async beginPurchase(_request) {
    throw new Error("NOT_IMPLEMENTED: discovery and approval flow begins in P2");
  }

  async resumePurchase() {
    throw new Error("NOT_IMPLEMENTED: cold restart resume begins in P4");
  }
}
