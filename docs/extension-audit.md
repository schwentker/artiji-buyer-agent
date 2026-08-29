# `xyz.artiji/commerce` extension audit

## Conclusion

The extension is large for this experiment: all six top-level disclosure fields, comprising eight scalar leaf values, are `SPEC_GAP`; zero are `LEGITIMATELY_MERCHANT_SPECIFIC` at the field-category level. The merchant must choose each value, but MCP/MPP lacks a standard MCP tool-discovery slot for each category the buyer required before payment.

That distinction matters. This finding does not propose standardizing Artiji's price, service window, artifact wording, or policies. It says an interoperable buyer has no standard place to obtain those categories as structured pre-payment terms.

## Classification rule

- `LEGITIMATELY_MERCHANT_SPECIFIC`: the field category is peculiar to this merchant or product and should remain private extension vocabulary.
- `SPEC_GAP`: the category is generally useful to buyers of paid, deferred MCP tools, but the consulted standard surfaces do not carry or map it.

The audit covers the six top-level fields added in P2. `price` contains three leaves (`amountMinor`, `currency`, and `display`); the other five fields contain one value each.

| Field | Classification | Justification |
| --- | --- | --- |
| `price` | `SPEC_GAP` | MPP discovery has a payment-offer price, but there is no normative mapping from that HTTP/OpenAPI discovery object to an MCP `Tool`. MCP tool metadata has no structured amount/currency slot. The USD 150 value and display string remain merchant choices. |
| `fulfillmentMode` | `SPEC_GAP` | MCP task support says execution may be asynchronous; it does not disclose that fulfillment is manual rather than automated. That distinction affects whether a buyer should purchase. `manual-deferred` is merchant data. |
| `expectedWindow` | `SPEC_GAP` | MCP Tasks exposes polling and task lifetime mechanics, not the merchant's expected delivery window or SLA before purchase. `3-5 days` is merchant data. |
| `resultType` | `SPEC_GAP` | The MCP Tasks `resultType` discriminator identifies a wire result shape; it does not describe the semantic artifact the deferred purchase is expected to deliver. Namespacing avoids a collision, but the expected-artifact category is still absent. |
| `refundPolicy` | `SPEC_GAP` | The policy text is merchant-specific, but refund terms are a general material disclosure for a paid service. MCP tool metadata and the MPP Stripe method do not provide a structured policy slot. |
| `cancellationPolicy` | `SPEC_GAP` | MCP task cancellation describes a protocol request and cooperative state transition, not the buyer's contractual right to cancel a paid order. The policy itself remains merchant-specific. |

## What the count means

The standard discovery composition was not clean: the buyer needed custom structured metadata for 6/6 required pre-payment categories and duplicated all six in untrusted tool-description text. The runtime composition was narrower and more successful: challenge, payment, durable task creation, replay, and polling worked after the implementation supplied idempotency, task-claim, receipt-binding, and artifact-correlation rules.

Only the receipt-to-task lifecycle seam is proposed for the minimal upstream transport diff. The six discovery categories need separate design work; folding them into that diff would obscure the demonstrated issue.

## Evidence basis

This classification carries forward P2 entries P2-001 through P2-006 in `docs/gap-log.md`. Sources were retrieved 2026-08-28: [MCP Tools](https://modelcontextprotocol.io/specification/draft/server/tools), [MCP Tasks](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks), [MPP discovery at pinned commit](https://github.com/tempoxyz/mpp-specs/blob/ccab885d85d50018a4fc004034f2da7a7f63e33c/specs/extensions/draft-payment-discovery-01.md), [MPP-over-MCP at pinned commit](https://github.com/tempoxyz/mpp-specs/blob/ccab885d85d50018a4fc004034f2da7a7f63e33c/specs/extensions/transports/draft-payment-transport-mcp-00.md), and [Stripe charge at pinned commit](https://github.com/tempoxyz/mpp-specs/blob/ccab885d85d50018a4fc004034f2da7a7f63e33c/specs/methods/stripe/draft-stripe-charge-00.md).

The audit is a draft-spec snapshot, not a claim that no other commerce vocabulary exists. See `docs/limitations.md` before using the vectors as evidence.
