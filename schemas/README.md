# P1 wire contracts

The sole offer mirrors Artiji's current `individual` SKU, priced at `15000` USD minor units ($150.00). It has a 3–5 day fulfillment window and returns a full chart analysis artifact.

`receipt.schema.json` intentionally has no `settlement` field. `challengeId` is the MPP-over-MCP transport binding, not a card-method-specific field. The seller will persist an internal receipt-to-task relation in P3; that relation is not represented as a new receipt field.

The schemas are deliberately dependency-free JSON Schema artifacts. Runtime validation and handlers are deferred until their P2/P3 phases.
