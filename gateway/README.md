# P5 observability proxy

This repository uses a small transparent local MCP proxy as the P5 gateway. It forwards HTTP JSON-RPC to the seller and records redacted request/response summaries plus raw-body hashes. It is not TrueForge's optional MCP Gateway and does not decode MPP: payment challenges, credentials, and receipts remain opaque payloads.

The proxy exists only to answer whether ordinary MCP traces make paid calls legible. It records payment-related error/metadata keys as transport observations, not as payment semantics.
