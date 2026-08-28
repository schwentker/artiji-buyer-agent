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
