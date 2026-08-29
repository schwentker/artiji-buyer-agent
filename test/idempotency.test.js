import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createSellerStub } from "../seller/seller-stub.js";

class FakeStripeClient {
  constructor() {
    this.requestCount = 0;
    this.byIdempotencyKey = new Map();
  }

  async createAndConfirm(request) {
    this.requestCount += 1;
    if (!this.byIdempotencyKey.has(request.idempotencyKey)) {
      this.byIdempotencyKey.set(request.idempotencyKey, {
        id: "pi_test_single_payment_intent",
        status: "succeeded",
        created: 1787976000
      });
    }
    return this.byIdempotencyKey.get(request.idempotencyKey);
  }
}

async function rpc(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, raw: await response.text() };
}

test("P3 contract: challenge, paid retry, and replay produce one PaymentIntent and one byte-identical success", async (context) => {
  const payments = new FakeStripeClient();
  const seller = createSellerStub({
    stripeSecretKey: "sk_test_contract_fixture",
    stripeClient: payments
  });
  const server = createMcpHttpServer({ seller });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => {
    server.close();
    seller.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const args = {
    syntheticSubject: "fixture",
    idempotencyKey: "replay-key-0000000000000001"
  };

  const challenge = await rpc(url, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "order_reading", arguments: args }
  });
  const challengeBody = JSON.parse(challenge.raw);
  assert.equal(challenge.status, 200);
  assert.equal(challengeBody.error.code, -32042);
  assert.equal(challengeBody.error.data.httpStatus, 402);

  const paidRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "order_reading",
      arguments: args,
      _meta: { "org.paymentauth/credential": { paymentMethod: "pm_card_visa" } }
    }
  };
  const paid = await rpc(url, paidRequest);
  const replay = await rpc(url, paidRequest);
  const paidBody = JSON.parse(paid.raw);

  assert.equal(paid.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.raw, paid.raw);
  assert.equal(paidBody.result._meta["org.paymentauth/receipt"].reference, "pi_test_single_payment_intent");
  assert.equal(payments.requestCount, 1);
  assert.deepStrictEqual(seller.store.evidence(), { orders: 1, paymentIntents: 1, tasks: 1, receipts: 1 });

  const task = await rpc(url, {
    jsonrpc: "2.0",
    id: 3,
    method: "tasks/get",
    params: { taskId: paidBody.result.taskId }
  });
  const taskBody = JSON.parse(task.raw);
  assert.equal(task.status, 200);
  assert.equal(taskBody.result.taskId, paidBody.result.taskId);
  assert.deepStrictEqual(
    taskBody.result._meta["org.paymentauth/receipt"],
    paidBody.result._meta["org.paymentauth/receipt"]
  );

  const conflict = await rpc(url, {
    ...paidRequest,
    id: 4,
    params: {
      ...paidRequest.params,
      arguments: { ...args, syntheticSubject: "different fixture" }
    }
  });
  assert.equal(JSON.parse(conflict.raw).error.code, -32043);
  assert.equal(payments.requestCount, 1);
});
