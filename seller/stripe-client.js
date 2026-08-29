import { assertTestModeStripeKey } from "./config.js";

export class StripePaymentClient {
  constructor({ secretKey, fetchImpl = fetch }) {
    this.secretKey = assertTestModeStripeKey(secretKey);
    this.fetchImpl = fetchImpl;
    this.requestCount = 0;
  }

  async createAndConfirm({ amountMinor, currency, description, externalId, challengeId, paymentMethod, idempotencyKey }) {
    if (!paymentMethod?.startsWith("pm_")) throw new Error("STRIPE_PAYMENT_METHOD_REQUIRED");
    const body = new URLSearchParams();
    body.set("amount", String(amountMinor));
    body.set("currency", currency.toLowerCase());
    body.set("description", description);
    body.set("payment_method", paymentMethod);
    body.append("payment_method_types[]", "card");
    body.set("confirm", "true");
    body.set("error_on_requires_action", "true");
    body.set("metadata[external_id]", externalId);
    body.set("metadata[challenge_id]", challengeId);

    this.requestCount += 1;
    const response = await this.fetchImpl("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey
      },
      body
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`STRIPE_PAYMENT_INTENT_FAILED: ${payload.error?.message ?? response.status}`);
    if (payload.status !== "succeeded") throw new Error(`STRIPE_PAYMENT_NOT_SUCCEEDED: ${payload.status}`);
    return payload;
  }
}
