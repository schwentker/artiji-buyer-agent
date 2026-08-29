import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createOperatorFixture } from "../seller/operator-fixture.js";
import { createSellerStub } from "../seller/seller-stub.js";
import { canonicalJson, sha256 } from "../shared/canonical.js";

const FIXED_TASK_ID = "cHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHA";

class VectorStripeClient {
  constructor() {
    this.requestCount = 0;
  }

  async createAndConfirm() {
    this.requestCount += 1;
    return {
      id: "pi_vector_test_0001",
      status: "succeeded",
      created: 1788004800
    };
  }
}

async function post(url, body) {
  const requestRaw = canonicalJson(body);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestRaw
  });
  const responseRaw = await response.text();
  return {
    request: {
      method: "POST",
      path: "/mcp",
      contentType: "application/json",
      body: requestRaw,
      sha256: sha256(requestRaw)
    },
    response: {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: responseRaw,
      sha256: sha256(responseRaw)
    }
  };
}

export async function captureVectorSet() {
  const payments = new VectorStripeClient();
  const seller = createSellerStub({
    stripeSecretKey: "sk_test_vector_fixture",
    stripeClient: payments,
    challengeIdFactory: () => "challenge-vector-0001",
    taskIdFactory: () => FIXED_TASK_ID,
    now: () => Date.parse("2026-08-29T12:00:00.000Z")
  });
  const operator = createOperatorFixture({ seller });
  const server = createMcpHttpServer({ seller });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const arguments_ = {
    syntheticSubject: "synthetic-vector-subject",
    idempotencyKey: "vector-idempotency-key-00000001"
  };
  const challengeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "order_reading", arguments: arguments_ }
  };
  const paidRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "order_reading",
      arguments: arguments_,
      _meta: { "org.paymentauth/credential": { paymentMethod: "pm_card_visa" } }
    }
  };

  try {
    const challenge = await post(url, challengeRequest);
    const paidSuccess = await post(url, paidRequest);
    const replay = await post(url, paidRequest);
    const poll = await post(url, {
      jsonrpc: "2.0",
      id: 3,
      method: "tasks/get",
      params: { taskId: FIXED_TASK_ID }
    });
    operator.publishArtifact({
      taskId: FIXED_TASK_ID,
      id: "artifact-vector-0001",
      url: "https://artifacts.example.test/vector-0001",
      orderReference: "pi_vector_test_0001"
    });
    const completed = await post(url, {
      jsonrpc: "2.0",
      id: 4,
      method: "tasks/get",
      params: { taskId: FIXED_TASK_ID }
    });
    return {
      format: "artiji-buyer-agent-byte-exact-http-entity-v1",
      fixture: {
        syntheticOnly: true,
        taskIdIsNonSecretDeterministicTestData: true,
        paymentProvider: "fake Stripe boundary",
        stripeRequests: payments.requestCount
      },
      vectors: { challenge, paidSuccess, replay, poll, completed }
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    seller.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await captureVectorSet(), null, 2)}\n`);
}
