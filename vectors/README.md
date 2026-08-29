# Deferred paid-task vectors

`deferred-task-flow.json` records byte-exact JSON request and response entity bodies for five steps: payment challenge, paid task creation, idempotent replay, working poll, and completed poll. Each body has a SHA-256 digest. HTTP status, content type, and the stable request headers relevant to the flow are included; ephemeral transport headers and framing are not.

Run `npm run test:p6` with Node 22.5 or newer to regenerate the flow in memory and compare it byte-for-byte with the committed file.

These are deterministic task-wire vectors for one implementation. They declare the per-request Tasks capability, use current `CreateTaskResult` and `GetTaskResult` fields, nest the terminal `CallToolResult`, and include `Mcp-Method`/`Mcp-Name` on polling. They are not a complete MCP server or multi-implementation interoperability suite. The task ID is deliberately published, synthetic, deterministic, and non-secret; the payment provider is a fake Stripe boundary. See `docs/limitations.md`.
