import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createObservabilityProxy } from "../gateway/observability-proxy.js";
import { createSellerStub } from "../seller/seller-stub.js";
import { taskRoutingHeaders, withTasksCapability } from "../shared/mcp-tasks.js";

class FakeStripeClient {
  constructor(id = "pi_p5_fixture") { this.id = id; this.requestCount = 0; }
  async createAndConfirm() {
    this.requestCount += 1;
    return { id: this.id, status: "succeeded", created: 1787980000 };
  }
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}/mcp`;
}

async function rpc(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, raw: await response.text() };
}

async function createRoute({ scenario, dbPath, paymentId }) {
  const trace = [];
  const seller = createSellerStub({
    stripeSecretKey: "sk_test_contract_fixture",
    stripeClient: new FakeStripeClient(paymentId),
    dbPath
  });
  const sellerServer = createMcpHttpServer({ seller });
  const sellerUrl = await listen(sellerServer);
  const proxy = createObservabilityProxy({ targetUrl: sellerUrl, scenario, trace });
  const proxyUrl = await listen(proxy);
  return {
    seller,
    trace,
    proxyUrl,
    close: async () => {
      await new Promise((resolve) => proxy.close(resolve));
      await new Promise((resolve) => sellerServer.close(resolve));
      seller.close();
    }
  };
}

test("P5: gateway traces capture idempotent replay without decoding paid semantics", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "artiji-p5-replay-"));
  const route = await createRoute({ scenario: "idempotent-replay", dbPath: join(directory, "seller.sqlite"), paymentId: "pi_p5_replay" });
  context.after(async () => { await route.close(); rmSync(directory, { recursive: true, force: true }); });
  const args = { syntheticSubject: "p5-replay", idempotencyKey: "p5-replay-key-0000000000001" };
  const paidRequest = {
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: {
      name: "order_reading",
      arguments: args,
      _meta: withTasksCapability({
        "org.paymentauth/credential": { paymentMethod: "pm_card_visa" }
      })
    }
  };
  await rpc(route.proxyUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "order_reading", arguments: args, _meta: withTasksCapability() }
  });
  const paid = await rpc(route.proxyUrl, paidRequest);
  const replay = await rpc(route.proxyUrl, paidRequest);
  assert.equal(paid.status, 200);
  assert.equal(replay.raw, paid.raw);
  assert.equal(route.trace.length, 3);
  assert.equal(route.trace[0].response.paymentHttpStatus, 402);
  assert.equal(route.trace[1].response.receiptReference, "pi_p5_replay");
  assert.equal(route.trace[2].responseRawSha256, route.trace[1].responseRawSha256);
  assert.equal(route.trace.every((entry) => entry.gatewayDecodedPayment === false), true);
  console.log(`P5_EVIDENCE ${JSON.stringify({ scenario: "idempotent-replay", events: route.trace.length, traceSha256: route.trace.map((entry) => entry.responseRawSha256), paymentSemanticsDecoded: false })}`);
});

test("P5: gateway traces capture cold restart routed entirely through the proxy", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "artiji-p5-cold-"));
  const route = await createRoute({ scenario: "cold-restart", dbPath: join(directory, "seller.sqlite"), paymentId: "pi_p5_cold" });
  context.after(async () => { await route.close(); rmSync(directory, { recursive: true, force: true }); });
  const sellerUrl = route.proxyUrl;
  const childScript = new URL("../scripts/p4-buyer-process.js", import.meta.url);
  const { spawn } = await import("node:child_process");
  const buyerDbPath = join(directory, "buyer.sqlite");
  const readLine = (child) => new Promise((resolve, reject) => {
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; const i = output.indexOf("\n"); if (i >= 0) resolve(JSON.parse(output.slice(0, i))); });
    child.stderr.resume();
    child.on("error", reject);
  });
  const purchase = spawn(process.execPath, [childScript.pathname, "purchase", sellerUrl, buyerDbPath], { stdio: ["ignore", "pipe", "pipe"] });
  const paid = await readLine(purchase);
  const purchaseExit = once(purchase, "exit");
  purchase.kill("SIGKILL");
  await purchaseExit;
  const { BuyerStateStore } = await import("../buyer/state-store.js");
  const stateStore = new BuyerStateStore(buyerDbPath);
  const state = await stateStore.load("p4-cold-restart-session");
  stateStore.close();
  const resume = spawn(process.execPath, [childScript.pathname, "resume", sellerUrl, buyerDbPath], { stdio: ["ignore", "pipe", "pipe"] });
  const resumeExit = once(resume, "exit");
  setTimeout(() => route.seller.completeTask(state.taskId, { id: "p5-cold-artifact", url: "https://artifacts.example.test/p5-cold", orderReference: state.receipt.reference }), 150);
  const resumed = await readLine(resume);
  await resumeExit;
  assert.equal(paid.event, "PAID_PERSISTED");
  assert.equal(resumed.event, "COLD_RESUME_COMPLETED");
  assert.ok(route.trace.filter((entry) => entry.request.method === "tasks/get").length >= 2);
  assert.equal(route.trace.every((entry) => entry.gatewayDecodedPayment === false), true);
  console.log(`P5_EVIDENCE ${JSON.stringify({ scenario: "cold-restart", events: route.trace.length, tasksGetEvents: route.trace.filter((entry) => entry.request.method === "tasks/get").length, paymentSemanticsDecoded: false })}`);
});

test("P5: full lifecycle trace contains challenge, paid success, poll, and completed poll", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "artiji-p5-lifecycle-"));
  const route = await createRoute({ scenario: "full-lifecycle", dbPath: join(directory, "seller.sqlite"), paymentId: "pi_p5_lifecycle" });
  context.after(async () => { await route.close(); rmSync(directory, { recursive: true, force: true }); });
  const args = { syntheticSubject: "p5-lifecycle", idempotencyKey: "p5-lifecycle-key-0000000000001" };
  const challenge = await rpc(route.proxyUrl, {
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "order_reading", arguments: args, _meta: withTasksCapability() }
  });
  const paid = await rpc(route.proxyUrl, {
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: {
      name: "order_reading",
      arguments: args,
      _meta: withTasksCapability({
        "org.paymentauth/credential": { paymentMethod: "pm_card_visa" }
      })
    }
  });
  const taskId = JSON.parse(paid.raw).result.taskId;
  await rpc(
    route.proxyUrl,
    { jsonrpc: "2.0", id: 3, method: "tasks/get", params: { taskId } },
    taskRoutingHeaders(taskId)
  );
  route.seller.completeTask(taskId, { id: "p5-lifecycle-artifact", url: "https://artifacts.example.test/p5-lifecycle", orderReference: "pi_p5_lifecycle" });
  const completed = await rpc(
    route.proxyUrl,
    { jsonrpc: "2.0", id: 4, method: "tasks/get", params: { taskId } },
    taskRoutingHeaders(taskId)
  );
  assert.equal(challenge.status, 200);
  assert.equal(JSON.parse(challenge.raw).error.code, -32042);
  assert.equal(JSON.parse(completed.raw).result.status, "completed");
  assert.equal(JSON.parse(completed.raw).result.resultType, "complete");
  assert.deepStrictEqual(route.trace.map((entry) => entry.request.method), ["tools/call", "tools/call", "tasks/get", "tasks/get"]);
  assert.equal(route.trace.every((entry) => entry.gatewayDecodedPayment === false), true);
  console.log(`P5_EVIDENCE ${JSON.stringify({ scenario: "full-lifecycle", events: route.trace.length, methods: route.trace.map((entry) => entry.request.method), paymentSemanticsDecoded: false })}`);
});
