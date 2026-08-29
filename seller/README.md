# Seller stub

This is a fresh, local-only seller shape. It accepts only an `sk_test_` Stripe secret key, declares the P2 structured disclosure fields in `xyz.artiji/commerce`, and advertises one task-required `order_reading` tool. It imports no Artiji production code or configuration.

P3 implements the isolated money path: an MPP-style 402 JSON-RPC error, one Stripe test-mode PaymentIntent, atomic task/receipt persistence, and byte-exact replay over HTTP 200. See `docs/seller-durability.md` for the transaction boundary.

P4 adds an operator fixture that atomically binds artifact ID, URL, and payment order reference before setting task status to `completed`. SQLite rejects a completed task with incomplete artifact identity.

The P6 revision requires the per-request `io.modelcontextprotocol/tasks` client capability, persists task timestamps and TTL, returns current task result discriminators, nests the completed tool result, and carries the receipt on every `tasks/get`. It covers the demonstrated task wire path, not the complete MCP Tasks extension.
