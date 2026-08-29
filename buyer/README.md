# Buyer scaffold

The buyer is designed as a TrueForge session adapter: TrueForge supplies the session runtime and human checkpoint, while `BuyerStateStore` defines the durable commerce-state boundary. P2 implements discovery and approval. P3 persists payment state. P4 cold-resumes from SQLite, treats `tasks/get` as authoritative, checks the receipt on every poll, and accepts completion only with a correlated artifact.
