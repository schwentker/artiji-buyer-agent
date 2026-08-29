# Buyer scaffold

The buyer is designed as a TrueForge session adapter: TrueForge supplies the session runtime and human checkpoint, while `BuyerStateStore` defines the durable commerce-state boundary. P2 implements discovery, disclosure validation, and the approval boundary without any payment handler. P3 adds payment durability; P4 adds cold resume.
