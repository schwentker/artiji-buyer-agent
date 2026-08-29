export const DEFAULT_APPROVAL_THRESHOLD_MINOR = 10000;

/**
 * The injected callback is the adapter point for a TrueForge human checkpoint.
 * P2 intentionally stops before payment regardless of the decision.
 */
export class ApprovalGate {
  constructor({ thresholdMinor = DEFAULT_APPROVAL_THRESHOLD_MINOR, requestHumanApproval } = {}) {
    this.thresholdMinor = thresholdMinor;
    this.requestHumanApproval = requestHumanApproval ?? (async () => ({
      approved: false,
      pending: true,
      source: "trueforge-human-checkpoint"
    }));
  }

  async request({ amountMinor, currency, terms }) {
    if (amountMinor > this.thresholdMinor) {
      return this.requestHumanApproval({ amountMinor, currency, terms });
    }
    return { approved: true, source: "below-threshold" };
  }
}
