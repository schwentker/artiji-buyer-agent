# P3 seller durability boundary

The seller uses two SQLite transactions around one Stripe call:

1. `BEGIN IMMEDIATE` reserves `UNIQUE(merchant_id, idempotency_key)`, binds a SHA-256 request fingerprint, and stores the challenge plus deterministic Stripe idempotency key.
2. Stripe creates and confirms the test-mode PaymentIntent outside the database transaction.
3. A second `BEGIN IMMEDIATE` atomically inserts the task and receipt, binds them with foreign keys, stores the PaymentIntent ID, and stores the byte-exact JSON-RPC success.
4. The seller performs a fresh `tasks/get` lookup before returning HTTP 200 success.
5. Replay returns the stored response bytes without another Stripe request. A changed fingerprint returns JSON-RPC error `-32043`.

Database uniqueness covers merchant/idempotency key, challenge ID, Stripe idempotency key, PaymentIntent ID, task ID, and the receipt-to-task relation.
