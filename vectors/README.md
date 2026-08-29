# Deferred paid-task vectors

`deferred-task-flow.json` records byte-exact JSON request and response entity bodies for five steps: payment challenge, paid task creation, idempotent replay, working poll, and completed poll. Each body has a SHA-256 digest. HTTP status and content type are included; ephemeral transport headers and framing are not.

Run `npm run test:p6` with Node 22.5 or newer to regenerate the flow in memory and compare it byte-for-byte with the committed file.

These are deterministic evidence vectors for this repository, not MCP conformance vectors. The task ID is deliberately published, synthetic, deterministic, and non-secret. The payment provider is a fake Stripe boundary. Most importantly, the seller's reduced task shape omits fields required by the current MCP Tasks draft; see `docs/limitations.md`.
