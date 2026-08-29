import { COMMERCE_EXTENSION_NAMESPACE, FIXED_OFFER } from "../schemas/catalog.js";
import { canonicalJson, sha256 } from "../shared/canonical.js";
import { hasTasksCapability, TASKS_EXTENSION_ID } from "../shared/mcp-tasks.js";
import { assertTestModeStripeKey } from "./config.js";
import { SellerStore } from "./store.js";
import { StripePaymentClient } from "./stripe-client.js";

const CHALLENGE_META = "org.paymentauth/challenge";
const CREDENTIAL_META = "org.paymentauth/credential";
const RECEIPT_META = "org.paymentauth/receipt";

function buildChallenge(id, request, now) {
  return {
    id,
    realm: "artiji-buyer-agent.local",
    method: "stripe",
    intent: "charge",
    request: {
      amount: FIXED_OFFER.amountMinor,
      currency: FIXED_OFFER.currency,
      description: "Artiji individual deep reflection test fixture",
      externalId: request.idempotencyKey,
      methodDetails: { paymentMethodTypes: ["card"] }
    },
    expires: new Date(now() + 15 * 60 * 1000).toISOString()
  };
}

export function createSellerStub({
  stripeSecretKey,
  dbPath = ":memory:",
  stripeClient,
  merchantId = "seller.local",
  challengeIdFactory,
  taskIdFactory,
  now = Date.now
}) {
  assertTestModeStripeKey(stripeSecretKey);
  const store = new SellerStore(dbPath, {
    challengeIdFactory,
    taskIdFactory,
    now: () => new Date(now()).toISOString()
  });
  const payments = stripeClient ?? new StripePaymentClient({ secretKey: stripeSecretKey });

  return {
    merchantId,
    store,
    payments,
    protocolVersion: "2026-07-28",
    extensions: {
      [COMMERCE_EXTENSION_NAMESPACE]: {
        price: { amountMinor: FIXED_OFFER.amountMinor, currency: FIXED_OFFER.currency, display: "$150.00 USD" },
        fulfillmentMode: FIXED_OFFER.fulfillmentMode,
        expectedWindow: FIXED_OFFER.expectedWindow,
        resultType: FIXED_OFFER.resultType,
        refundPolicy: FIXED_OFFER.refundPolicy,
        cancellationPolicy: FIXED_OFFER.cancellationPolicy
      }
    },
    tools: [{
      name: "order_reading",
      description: "Paid individual deep reflection. $150.00 USD; manual-deferred fulfillment in 3-5 days; returns a full chart analysis artifact; full refund if fulfillment cannot be completed; cancellable before payment confirmation.",
      execution: { taskSupport: "required" },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["syntheticSubject", "idempotencyKey"],
        properties: {
          syntheticSubject: { type: "string", minLength: 1 },
          idempotencyKey: { type: "string", minLength: 24 }
        }
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    }],
    offer: FIXED_OFFER,
    async purchase(request) {
      if (!hasTasksCapability(request._meta)) {
        const body = {
          jsonrpc: "2.0",
          id: request.jsonRpcId ?? 1,
          error: {
            code: -32003,
            message: "Missing required client capability",
            data: {
              requiredCapabilities: {
                extensions: { [TASKS_EXTENSION_ID]: {} }
              }
            }
          }
        };
        return { httpStatus: 200, rawBody: canonicalJson(body), body };
      }
      const requestFingerprint = sha256({
        merchantId,
        sku: FIXED_OFFER.sku,
        syntheticSubject: request.syntheticSubject,
        amountMinor: FIXED_OFFER.amountMinor,
        currency: FIXED_OFFER.currency
      });
      const order = store.reserve({
        merchantId,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint,
        challengeFactory: (id) => buildChallenge(id, request, now)
      });

      if (order.response_json) {
        return { httpStatus: 200, rawBody: order.response_json, body: JSON.parse(order.response_json), replayed: true };
      }

      const credential = request._meta?.[CREDENTIAL_META];
      if (!credential) {
        const body = {
          jsonrpc: "2.0",
          id: request.jsonRpcId ?? 1,
          error: {
            code: -32042,
            message: "Payment required",
            data: { httpStatus: 402, [CHALLENGE_META]: [JSON.parse(order.challenge_json)] }
          }
        };
        return { httpStatus: 200, rawBody: canonicalJson(body), body };
      }

      const paymentIntent = await payments.createAndConfirm({
        amountMinor: FIXED_OFFER.amountMinor,
        currency: FIXED_OFFER.currency,
        description: "Artiji individual deep reflection test fixture",
        externalId: request.idempotencyKey,
        challengeId: order.challenge_id,
        paymentMethod: credential.paymentMethod,
        idempotencyKey: order.stripe_idempotency_key
      });

      const responseJson = store.finalizePaid({
        orderId: order.id,
        paymentIntent,
        receiptFactory: ({ challengeId }) => ({
          status: "succeeded",
          method: "stripe",
          timestamp: new Date(paymentIntent.created * 1000).toISOString(),
          reference: paymentIntent.id,
          challengeId
        }),
        responseFactory: ({ task, receipt }) => canonicalJson({
          jsonrpc: "2.0",
          id: request.jsonRpcId ?? 1,
          result: {
            resultType: "task",
            ...task,
            _meta: { [RECEIPT_META]: receipt }
          }
        })
      });
      const body = JSON.parse(responseJson);
      if (!store.getTask(body.result.taskId)) throw new Error("TASK_NOT_DURABLE_BEFORE_SUCCESS");
      return { httpStatus: 200, rawBody: responseJson, body, replayed: false };
    },
    getTask(taskId, jsonRpcId = 1) {
      const task = store.getTask(taskId);
      if (!task) return null;
      return {
        jsonrpc: "2.0",
        id: jsonRpcId,
        result: {
          resultType: "complete",
          taskId: task.taskId,
          status: task.status,
          createdAt: task.createdAt,
          lastUpdatedAt: task.lastUpdatedAt,
          ttlMs: task.ttlMs,
          ...(task.artifact ? {
            result: {
              content: [{
                type: "resource_link",
                name: task.artifact.id,
                uri: task.artifact.url
              }],
              structuredContent: { artifact: task.artifact },
              isError: false
            }
          } : {}),
          _meta: { [RECEIPT_META]: task.receipt }
        }
      };
    },
    completeTask(taskId, artifact) {
      return store.completeTask(taskId, artifact);
    },
    close() {
      store.close();
    }
  };
}
