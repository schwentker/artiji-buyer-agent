export const FIXED_OFFER = Object.freeze({
  sku: "individual",
  amountMinor: 15000,
  currency: "USD",
  fulfillmentMode: "manual-deferred",
  expectedWindow: "3-5 days",
  resultType: "full chart analysis artifact",
  refundPolicy: "full refund if fulfillment cannot be completed",
  cancellationPolicy: "cancellable before payment confirmation"
});

export const COMMERCE_EXTENSION_NAMESPACE = "xyz.artiji/commerce";

export const REQUIRED_DISCLOSURE_FIELDS = Object.freeze([
  "price",
  "fulfillmentMode",
  "expectedWindow",
  "resultType",
  "refundPolicy",
  "cancellationPolicy"
]);
