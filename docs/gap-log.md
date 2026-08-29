# Specification gap log

This log is append-only. Tiers: `OFFICIAL`, `COMMUNITY`, `INFERRED`, `TEMPORAL`.

## P0-001 — Payment receipt to task correlation is not defined

- Timestamp: 2026-08-28T14:26:25-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: When a paid `tools/call` returns an MCP `CreateTaskResult`, neither the MPP JSON-RPC/MCP transport draft nor the MCP Tasks extension says that `org.paymentauth/receipt` applies to the returned `taskId`. Neither says whether the receipt must be repeated on `tasks/get` responses or `notifications/tasks` across the task lifecycle.
- Assumption for the experiment: The receipt in a paid `CreateTaskResult` applies to the co-located `taskId`. The seller will persist an internal receipt-to-task foreign-key relationship and repeat the byte-identical receipt in `_meta["org.paymentauth/receipt"]` on every successful `tasks/get` response and task notification.
- Reproduction: Read the MPP transport draft's “Payment Receipt” and “MCP Covered Operations” sections and search it for `task`, `taskId`, `CreateTaskResult`, and `tasks/get` (all `NOT_FOUND`). Read the MCP Tasks “Task Creation,” “Task Polling,” and “Task Status Notifications” sections and search it for `Payment` and `receipt` (both `NOT_FOUND`).
- Sections consulted: `draft-payment-transport-mcp-00` / Payment Receipt; MCP Covered Operations. MCP Tasks draft / Task Creation; Task Polling; Task Status Notifications. Cross-spec binding: `NOT_FOUND`.
- Invalidation condition: A ratified MPP-over-MCP or MCP Tasks revision normatively defines receipt-to-task binding and lifecycle propagation.

## P0-002 — MCP paid-tool discovery has no standard material-terms shape

- Timestamp: 2026-08-28T14:26:25-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP tool metadata exposes descriptions, schemas, annotations, and task support, but no standard fields for price, fulfillment mode/window, result type, refund policy, or cancellation terms. MPP discovery defines OpenAPI `x-payment-info` for HTTP operations, not a mapping to MCP `tools/list`, and its payment offer does not cover deferred-fulfillment or refund/cancellation terms.
- Assumption for the experiment: Material terms will be duplicated in the tool description for baseline visibility. `xyz.artiji/commerce` will start as an empty object; P2 may add only fields that a buyer cannot obtain from standard MCP/MPP surfaces.
- Reproduction: Compare the MCP Tools `Tool` definition and the MPP discovery `x-payment-info` payment-offer fields with the six buyer-required disclosure terms. Search the MPP-over-MCP transport draft for a discovery mapping from OpenAPI operations to MCP tools (`NOT_FOUND`).
- Sections consulted: MCP Tools / Tool definition. `draft-payment-discovery-01` / Payment Offer Object; Input Schema; Output Schema. `draft-payment-transport-mcp-00` / Capability Advertisement. MCP material-terms mapping: `NOT_FOUND`.
- Invalidation condition: A standard MCP commerce/payment discovery extension defines these terms or normatively maps `x-payment-info` and fulfillment policies onto MCP tools.

## P0-003 — Current MPP-over-MCP capability examples lag the current MCP extension model

- Timestamp: 2026-08-28T14:26:25-07:00
- Tier: OFFICIAL + TEMPORAL
- What the specifications did not answer: The current MPP transport draft cites MCP `2025-11-25` and advertises payment under `InitializeResult.capabilities.experimental.payment`. The current MCP Tasks extension uses per-request `io.modelcontextprotocol/clientCapabilities.extensions` and server `server/discover.capabilities.extensions` for protocol `2026-07-28`. The MPP draft does not state the current extension identifier or the expected negotiation shape for payment on that protocol version.
- Assumption for the experiment: The seller will use the current MCP `2026-07-28` request envelope and Tasks negotiation, while treating MPP challenge/credential/receipt keys and error codes as payload-level rules. Payment capability advertising will be documented as experimental evidence rather than claimed interoperable behavior.
- Reproduction: Compare `draft-payment-transport-mcp-00` “MCP Capability Advertisement” with the MCP Tasks “Capability Negotiation” section and the Artiji server's `PROTOCOL_VERSION`/`SERVER_CAPABILITIES` at commit `2e1664b118cfb1fe2ee432ad63b2dc3872bb53cc`.
- Sections consulted: `draft-payment-transport-mcp-00` / MCP Capability Advertisement. MCP Tasks / Capability Negotiation. A 2026-07-28 MPP payment capability identifier: `NOT_FOUND`.
- Invalidation condition: The MPP transport draft is revised for MCP `2026-07-28` extension negotiation or the current MCP spec defines backward-compatible handling for `experimental.payment`.

## P0-004 — Buyer-controlled replay identity is not standardized end to end

- Timestamp: 2026-08-28T14:26:25-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: The Stripe charge method recommends a server-to-Stripe idempotency key derived from challenge ID and SPT, while MPP core requires challenge replay protection. Neither defines a buyer-supplied merchant idempotency key and request fingerprint that survives response loss, process restart, and a replay of the logical purchase while returning the same receipt and task handle.
- Assumption for the experiment: The tool input will carry a buyer-generated idempotency key. SQLite will enforce `UNIQUE(merchant, idempotency_key)` and bind it to a canonical request fingerprint. A deterministic Stripe idempotency key will recover the same PaymentIntent after a crash.
- Reproduction: Read `draft-stripe-charge-00` “Verification Procedure,” “Settlement Procedure,” and “Idempotency”; read the core draft's challenge binding and replay requirements; search both for a merchant-scoped buyer idempotency record that binds the eventual task (`NOT_FOUND`).
- Sections consulted: `draft-stripe-charge-00` / Idempotency. `draft-httpauth-payment-00` / Challenge Binding; Replay Attacks. End-to-end logical purchase replay contract: `NOT_FOUND`.
- Invalidation condition: Core, Stripe method, or MPP-over-MCP transport standardizes a durable logical-purchase idempotency contract including returned asynchronous work handles.

## P2-001 — Structured tool price is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP tool metadata has no structured price amount, currency, or display field for a paid tool.
- Assumption for the experiment: `xyz.artiji/commerce.price` carries `{amountMinor, currency, display}` while the same USD 150.00 term remains in the tool description.
- Reproduction: Read the MCP Tools `Tool` definition and MPP discovery payment-offer object; neither normatively maps a price object onto MCP `tools/list`.
- Sections consulted: MCP Tools / Tool definition; `draft-payment-discovery-01` / Payment Offer Object. MCP price field: `NOT_FOUND`.
- Invalidation condition: A ratified MCP payment/commerce extension defines a structured per-tool price field.

## P2-002 — Fulfillment mode is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP has no structured indication that the paid result is manual deferred fulfillment rather than immediate tool output.
- Assumption for the experiment: `xyz.artiji/commerce.fulfillmentMode` is `manual-deferred`, duplicated in the tool description.
- Reproduction: Inspect MCP Tools metadata and MPP discovery; neither exposes a deferred-fulfillment mode for an MCP tool.
- Sections consulted: MCP Tools / Tool definition; `draft-payment-discovery-01` / Payment Offer Object. MCP fulfillment mode: `NOT_FOUND`.
- Invalidation condition: A ratified MCP commerce/payment extension defines fulfillment mode for tools.

## P2-003 — Fulfillment window is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP and MPP discovery do not define a structured expected fulfillment window for a paid MCP task.
- Assumption for the experiment: `xyz.artiji/commerce.expectedWindow` is `3-5 days`, duplicated in the tool description.
- Reproduction: Inspect MCP Tools metadata and MPP discovery fields for an SLA or fulfillment deadline (`NOT_FOUND`).
- Sections consulted: MCP Tools / Tool definition; `draft-payment-discovery-01` / Payment Offer Object. MCP fulfillment window: `NOT_FOUND`.
- Invalidation condition: A ratified MCP commerce/payment extension defines a machine-readable fulfillment window.

## P2-004 — Result type is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: An MCP tool schema can describe input and immediate structured output, but it does not describe the semantic artifact a deferred paid task will later deliver.
- Assumption for the experiment: `xyz.artiji/commerce.resultType` is `full chart analysis artifact`, duplicated in the tool description.
- Reproduction: Compare MCP Tools input/output schema semantics with MCP Tasks task creation and polling; no field describes the expected deferred artifact type.
- Sections consulted: MCP Tools / Tool definition; MCP Tasks / Task Creation; Task Polling. Deferred result type: `NOT_FOUND`.
- Invalidation condition: MCP Tasks or a ratified commerce extension defines an expected result-artifact type.

## P2-005 — Refund policy is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: Neither MCP tool metadata nor the MPP Stripe charge method carries a merchant refund policy for a deferred paid tool.
- Assumption for the experiment: `xyz.artiji/commerce.refundPolicy` is `full refund if fulfillment cannot be completed`, duplicated in the tool description.
- Reproduction: Search MCP Tools, MCP Tasks, MPP core, and the Stripe charge method for a merchant refund-policy field (`NOT_FOUND`).
- Sections consulted: MCP Tools / Tool definition; MCP Tasks draft; `draft-httpauth-payment-00`; `draft-stripe-charge-00`. Refund policy: `NOT_FOUND`.
- Invalidation condition: A ratified MCP commerce/payment extension defines a refund-policy field.

## P2-006 — Cancellation policy is not standard MCP metadata

- Timestamp: 2026-08-28T18:01:04-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP Tasks supports task lifecycle states but does not define merchant cancellation rights or a paid tool's cancellation policy.
- Assumption for the experiment: `xyz.artiji/commerce.cancellationPolicy` is `cancellable before payment confirmation`, duplicated in the tool description.
- Reproduction: Search MCP Tasks and MPP-over-MCP for cancellation policy or merchant cancellation terms (`NOT_FOUND`).
- Sections consulted: MCP Tasks / lifecycle; `draft-payment-transport-mcp-00`. Paid-tool cancellation policy: `NOT_FOUND`.
- Invalidation condition: A ratified MCP commerce/payment extension defines cancellation policy.

## P3-001 — Paid task claim identity and transferability are not composed across MPP and MCP Tasks

- Timestamp: 2026-08-28T18:13:24-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MPP-over-MCP does not bind the payer or payment credential to the returned MCP task, while MCP Tasks permits opaque high-entropy task IDs but does not define whether a paid task claim should be bearer-transferable or proof-of-possession-bound.
- Assumption for the experiment: A 256-bit random `taskId` is a transferable bearer capability. Possession authorizes `tasks/get`; raw task IDs are persisted locally and excluded from committed traces.
- Reproduction: Read MPP-over-MCP Payment Receipt and MCP Covered Operations, then MCP Tasks Security Considerations; search for payer identity, task claimant, proof of possession, and transferability across the two drafts (`NOT_FOUND`).
- Sections consulted: `draft-payment-transport-mcp-00` / Payment Receipt; MCP Covered Operations. MCP Tasks / Security Considerations. Cross-spec paid-task claim model: `NOT_FOUND`.
- Invalidation condition: A ratified MPP/MCP Tasks composition rule binds payer identity or proof material to task access, or normatively specifies bearer transferability.

## P4-001 — Receipt preservation across task polling is implementation-defined

- Timestamp: 2026-08-28T19:00:35-07:00
- Tier: OFFICIAL + TEMPORAL + INFERRED
- What the specifications did not answer: Neither MPP-over-MCP nor MCP Tasks requires the payment receipt attached to task creation to be returned on every later `tasks/get` response or task notification.
- Assumption for the experiment: The seller persists one byte-equivalent receipt-to-task relation and repeats the receipt on every authoritative `tasks/get`; the buyer rejects any missing or changed receipt.
- Reproduction: Pay the synthetic task, persist buyer state, send SIGKILL to that buyer process, restart a different process with only the SQLite state, and poll `tasks/get` three times. The custom seller preserved the receipt; a controlled mismatched-receipt response produced `RECEIPT_CORRELATION_MISMATCH`.
- Sections consulted: `draft-payment-transport-mcp-00` / Payment Receipt; MCP Covered Operations. MCP Tasks / Task Polling; Task Status Notifications. Receipt lifecycle rule: `NOT_FOUND`.
- Invalidation condition: A ratified MPP-over-MCP or MCP Tasks revision requires receipt-to-task binding and receipt preservation across task reads and notifications.

## P4-002 — Deferred artifact-to-order correlation has no standard result shape

- Timestamp: 2026-08-28T19:00:35-07:00
- Tier: OFFICIAL + INFERRED
- What the specifications did not answer: MCP Tasks defines task state but not a standard artifact identity or payment-order correlation field for a completed paid task.
- Assumption for the experiment: The seller's tool-specific artifact carries `orderReference`, equal to the persisted payment receipt reference, and binds it atomically before status becomes `completed`.
- Reproduction: Complete a paid fixture with a matching artifact reference, then retry with a null URL and with a mismatched order reference. The valid artifact completes; both invalid forms are rejected.
- Sections consulted: MCP Tasks / Task Results; `draft-payment-transport-mcp-00` / Payment Receipt. Standard paid-artifact order correlation: `NOT_FOUND`.
- Invalidation condition: MCP Tasks or an MPP composition rule defines artifact identity and correlation for deferred paid results.
