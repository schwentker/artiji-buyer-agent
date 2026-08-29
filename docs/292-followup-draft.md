Correction after implementing a buyer-side fixture against the current drafts:

1. A successful paid JSON-RPC response is HTTP 200, not 202.
2. `challengeId` is added by the MPP-over-MCP receipt transport; it is not a Stripe-card or MPP-core receipt field.
3. Stripe `PaymentIntent.status=succeeded` permits protocol success, but the payment is not yet economically final for the merchant.

The current core receipt is `status`, `method`, `timestamp`, and `reference`. The Stripe method maps `reference` to the PaymentIntent ID and `timestamp` to confirmation time.

Working example: an isolated synthetic buyer/seller completed a USD 150 Stripe test-mode purchase as 402-in-JSON-RPC challenge → credential retry → HTTP 200 `CreateTaskResult` plus receipt → byte-identical idempotent replay with one PaymentIntent → buyer `SIGKILL` → cold restart → three `tasks/get` polls → correlated artifact completion.

The cross-spec seam I found is narrower than the original issue: neither MPP-over-MCP nor MCP Tasks says that the receipt returned beside a `CreateTaskResult` applies to its `taskId`, or requires preserving it on later `tasks/get` and `notifications/tasks` messages.

Minimal transport text:

> When a successful paid response contains an MCP `CreateTaskResult`, the server MUST associate its Payment Receipt with that result's `taskId`. While the task remains retrievable, the server MUST include the same receipt values on every successful `tasks/get` response and every `notifications/tasks` notification for that task.

Caveat: the regenerated vectors now use the current task fields, terminal result nesting, client capability declaration, and polling headers, but they remain evidence from one local implementation. I did not test task notifications or cross-implementation interoperability.
