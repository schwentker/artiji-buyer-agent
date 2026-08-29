# Honest limitations

## Protocol scope

- The seller is a fresh experimental stub, not Artiji production. Its HTTP surface implements the core discoverable MCP tool-server path, not every MCP capability.
- The revised demonstrated path uses the current MCP Tasks wire fields: per-request client capability declaration, missing-capability error, `resultType: "task"` creation, durable timestamps and TTL, `resultType: "complete"` polling, terminal `CallToolResult` nesting, and `Mcp-Method`/`Mcp-Name` polling headers.
- The committed vectors are deterministic task-wire evidence from one implementation. They are not a complete MCP conformance suite or a cross-implementation interoperability result.
- The live transport implements `initialize`, initialized notifications, session IDs, ping, `tools/list`, `tools/call`, DELETE session termination, JSON responses over Streamable HTTP, and raw `tasks/get`. It does not implement resources, prompts, task update/cancel, subscription negotiation, server-to-client SSE streams, resumability with `Last-Event-ID`, or every optional MCP method.
- No `notifications/tasks` transport was implemented. P4 injected a fabricated wake hint and then polled `tasks/get`; notification receipt preservation is proposed normatively but not demonstrated.
- The MPP-over-MCP draft used for payment payload rules targets MCP `2025-11-25`, while the task flow follows the MCP Tasks draft retrieved 2026-08-28 and labels its envelope `2026-07-28`. No compatibility rule was invented.
- P3-P5 trace exports are immutable historical records of the original runs and contain pre-revision response hashes. The P6 vectors, generator, and tests are the current reproducible wire evidence.

## Payment and commerce coverage

- P3 created one real Stripe test-mode USD 150 PaymentIntent. P4-P6 and this revision use deterministic fake Stripe clients at the provider boundary. No live-mode money, customers, or production credentials were used.
- The payer fixture passes Stripe's `pm_card_visa` test PaymentMethod ID; it is not a production wallet, delegated credential, or full shared-payment-token integration.
- Only a successful card-confirmation path was tested. Authentication-required, declined, asynchronous, timeout, webhook, refund, dispute, cancellation, expiration, and economically final settlement paths were not tested.
- Only the `individual` SKU, USD, and one disclosure vocabulary were examined. The extension audit should not be generalized to every commerce product or payment method.

## Durability and security

- SQLite durability was tested locally, with the buyer killed after persisting paid state. Seller-process death between Stripe confirmation and database finalization was not force-tested.
- There was no load, concurrent-writer, multi-process seller, replicated database, or network-partition test.
- The task ID is a transferable bearer capability. The buyer database is unencrypted, and proof-of-possession, authorization, expiry enforcement, and revocation were not implemented.
- Artifact storage is a synthetic URL; the live demo serves a local synthetic artifact page. Content integrity, confidentiality, availability, and actual fulfillment quality were not verified.

## Harness and observability

- TrueForge `0.1.4` accepted the local server as a connected custom MCP connector and the repository includes a runnable agent-facing tool surface. No model-provider credential, completed model turn, or TrueForge UI approval is committed or claimed; those remain machine-local judge setup.
- The `order_reading` agent bridge expects the harness to approve the write tool, then performs the experimental 402 challenge/test-credential retry inside the server. This proves that a generic MCP agent can operate the experiment, not that TrueForge natively interprets MPP or MCP Tasks.
- P5 used a local transparent observability proxy, not the optional hosted TrueForge MCP Gateway. It forwards the task routing headers and records protocol-level hashes and redacted fields without decoding MPP semantics.

## Contribution boundary

- The upstream diff and issue #292 follow-up are drafts. No issue comment or pull request was posted.
- The textual receipt-to-task gap survives independently because it is reproduced by comparing the MPP-over-MCP and MCP Tasks drafts. The implementation demonstrates that preservation is feasible in the scoped task flow.
- Publication recommendation: the draft and regenerated vectors are suitable for review as explicitly scoped single-implementation task-wire evidence. They should not be described as complete MCP conformance or interoperability evidence.
