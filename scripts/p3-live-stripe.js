import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256 } from "../shared/canonical.js";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createSellerStub } from "../seller/seller-stub.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey?.startsWith("sk_test_")) throw new Error("STRIPE_TEST_MODE_REQUIRED");

const tempDirectory = mkdtempSync(join(tmpdir(), "artiji-p3-"));
const seller = createSellerStub({
  stripeSecretKey: secretKey,
  dbPath: join(tempDirectory, "seller.sqlite")
});
const server = createMcpHttpServer({ seller });
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/mcp`;

async function rpc(body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, raw: await response.text() };
}

try {
  const idempotencyKey = `p3-live-${randomUUID()}`;
  const args = { syntheticSubject: "p3-live-synthetic-fixture", idempotencyKey };
  const challenge = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "order_reading", arguments: args }
  });
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
  const paid = await rpc(paidRequest);
  const replay = await rpc(paidRequest);
  const paidBody = JSON.parse(paid.raw);
  const task = await rpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tasks/get",
    params: { taskId: paidBody.result.taskId }
  });
  const taskBody = JSON.parse(task.raw);

  console.log(JSON.stringify({
    capturedAt: new Date().toISOString(),
    mode: "Stripe test mode",
    amountMinor: 15000,
    currency: "USD",
    challenge: {
      httpStatus: challenge.status,
      jsonRpcErrorCode: JSON.parse(challenge.raw).error.code,
      paymentHttpStatus: JSON.parse(challenge.raw).error.data.httpStatus
    },
    paid: {
      httpStatus: paid.status,
      receipt: paidBody.result._meta["org.paymentauth/receipt"],
      taskIdSha256: sha256(paidBody.result.taskId),
      rawResponseSha256: sha256(paid.raw)
    },
    replay: {
      httpStatus: replay.status,
      byteIdentical: replay.raw === paid.raw,
      rawResponseSha256: sha256(replay.raw)
    },
    tasksGet: {
      httpStatus: task.status,
      resolves: taskBody.result.taskId === paidBody.result.taskId,
      receiptPreserved: canonicalJson(taskBody.result._meta["org.paymentauth/receipt"]) === canonicalJson(paidBody.result._meta["org.paymentauth/receipt"])
    },
    stripeRequestsFromSeller: seller.payments.requestCount,
    database: seller.store.evidence(),
    redactions: ["taskId bearer capability", "Stripe secret key", "payer credential"]
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
  seller.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
