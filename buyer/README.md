# Buyer scaffold

The buyer is designed as a TrueForge session adapter: TrueForge supplies the session runtime and human checkpoint, while `BuyerStateStore` defines the durable commerce-state boundary. P2 implements discovery, disclosure validation, and the approval boundary. P3 durably persists the receipt, task ID, logical-purchase idempotency key, and payer material. P4 adds cold resume.
