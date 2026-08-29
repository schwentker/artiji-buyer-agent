# Buyer scaffold

The buyer is designed as a TrueForge session adapter: TrueForge supplies the session runtime and future human checkpoint, while `BuyerStateStore` defines the durable commerce-state boundary. The P1 interface intentionally has no purchase handler. P2 adds disclosure and approval behavior; P3 adds payment durability; P4 adds cold resume.
