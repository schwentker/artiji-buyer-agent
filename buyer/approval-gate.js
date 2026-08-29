export const DEFAULT_APPROVAL_THRESHOLD_MINOR = 10000;

/**
 * P1 wires the decision boundary but deliberately has no human UI yet.
 * TrueForge's human checkpoint will implement this port in P2.
 */
export class ApprovalGate {
  async request({ amountMinor, currency, terms }) {
    if (amountMinor > DEFAULT_APPROVAL_THRESHOLD_MINOR) {
      throw new Error(`APPROVAL_REQUIRED: ${amountMinor} ${currency}; ${terms?.sku ?? "unknown offer"}`);
    }
    return { approved: true, source: "below-threshold" };
  }
}
