# Seller stub

This is a fresh, local-only seller shape. It accepts only an `sk_test_` Stripe secret key, declares the P2 structured disclosure fields in `xyz.artiji/commerce`, and advertises one task-required `order_reading` tool. It imports no Artiji production code or configuration.

P3 implements the isolated money path: an MPP-style 402 JSON-RPC error, one Stripe test-mode PaymentIntent, atomic task/receipt persistence, and byte-exact replay over HTTP 200. See `docs/seller-durability.md` for the transaction boundary.
