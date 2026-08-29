export function assertTestModeStripeKey(secretKey) {
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("STRIPE_TEST_MODE_REQUIRED");
  }
  return secretKey;
}
