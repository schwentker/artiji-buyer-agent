# Honest limitations

## Protocol conformance

- The seller is a fresh experimental stub, not Artiji production and not a complete MCP server.
- Its task wire shape is reduced and does not conform to all current MCP Tasks requirements. It omits `resultType`, `createdAt`, `lastUpdatedAt`, `ttlMs`, and the standard terminal `result` nesting; it adds experiment-specific `pollUri` and top-level `artifact` fields. The committed vectors are therefore repository evidence vectors, not MCP conformance or interoperability vectors.
- The stub does not implement full initialization, capability negotiation, `server/discover`, `tools/list`, `tasks/update`, `tasks/cancel`, subscription negotiation, or Streamable HTTP task-routing headers.
- The MPP-over-MCP draft used for the payload rules targets MCP `2025-11-25`, while the experiment labels its reduced envelope `2026-07-28`. No compatibility rule was invented.
- No `notifications/tasks` transport was implemented. P4 injected a fabricated wake hint and then polled `tasks/get`; notification receipt preservation is specified only in the proposed text, not demonstrated.

## Payment and commerce coverage

- P3 created one real Stripe test-mode USD 150 PaymentIntent. P4-P6 used deterministic fake Stripe clients at the provider boundary. No live-mode money, customers, or production credentials were used.
- The payer fixture passes Stripe's `pm_card_visa` test PaymentMethod ID; it is not a production wallet, delegated credential, or full shared-payment-token integration.
- Only a successful card-confirmation path was tested. Authentication-required, declined, asynchronous, timeout, webhook, refund, dispute, cancellation, expiration, and economically final settlement paths were not tested.
- Only the `individual` SKU, USD, and one disclosure vocabulary were examined. The extension audit should not be generalized to every commerce product or payment method.

## Durability and security

- SQLite durability was tested locally, with the buyer killed after persisting paid state. Seller-process death between Stripe confirmation and database finalization was not force-tested.
- There was no load, concurrent-writer, multi-process seller, replicated database, or network-partition test.
- The task ID is a transferable bearer capability. The buyer database is unencrypted, and proof-of-possession, authorization, expiry enforcement, and revocation were not implemented.
- Artifact storage is a synthetic URL. Content integrity, confidentiality, availability, and actual fulfillment quality were not verified.

## Harness and observability

- TrueForge local mode was boot-checked, but no model provider, live TrueForge agent session, or TrueForge UI approval was configured. The tests exercise an application adapter and injected approval callback.
- P5 used a local transparent observability proxy, not the optional hosted TrueForge MCP Gateway. It records protocol-level hashes and redacted fields without decoding MPP semantics.

## Contribution boundary

- The upstream diff and issue #292 follow-up are drafts. No issue comment or pull request was posted.
- The textual receipt-to-task gap survives the fixture limitation because it is reproduced by comparing the two drafts. The implementation demonstrates that preservation is feasible, not that another implementation interoperates.
- Publication recommendation: correct the MCP Tasks wire shape and regenerate the vectors before calling them conformance evidence. The minimal normative text can still be reviewed as a specification-composition proposal.
