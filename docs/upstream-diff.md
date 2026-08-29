# Minimal upstream diff: bind receipts to asynchronous tasks

## Target

Add the following subsection to `specs/extensions/transports/draft-payment-transport-mcp-00.md`, immediately after its Payment Receipt rules. The comparison baseline is mpp-specs commit `ccab885d85d50018a4fc004034f2da7a7f63e33c`, retrieved 2026-08-28.

This belongs in MPP-over-MCP transport composition, not MPP core and not the Stripe payment method.

## Proposed normative text

### Payment Receipts for MCP Tasks

When a successful paid response contains an MCP `CreateTaskResult`, the Payment Receipt in `org.paymentauth/receipt` applies to the task identified by that result's `taskId`.

The server MUST preserve that Payment Receipt for the lifetime of the task. Every successful `tasks/get` response for that task and every `notifications/tasks` notification for that task MUST include the same Payment Receipt in `org.paymentauth/receipt`.

## Deliberate non-changes

- No receipt field is added or renamed.
- No `settlement` field is introduced.
- No payment-method semantics change; Stripe `succeeded` still need not mean economically final settlement.
- No rule is added to MPP core.
- No artifact or order-correlation shape is standardized.
- No claim is made that task notifications are more authoritative than `tasks/get`.

## Why this is the minimum

MPP-over-MCP requires a receipt on a successful paid JSON-RPC response. MCP Tasks lets that response be a durable `CreateTaskResult` and defines later task state through `tasks/get` and `notifications/tasks`, but neither draft binds the receipt to the returned `taskId` or carries it across that lifecycle. The proposed text closes only that cross-spec seam using the existing receipt metadata key and existing task identifier.

The local seller preserved the receipt and the buyer rejected a changed receipt after cold restart. That proves one implementation can enforce the rule; it does not prove interoperability. The current fixture also uses a reduced, non-conformant Task shape, as recorded in `docs/limitations.md`, so the normative case rests primarily on the specification comparison until the wire fixture is corrected.
