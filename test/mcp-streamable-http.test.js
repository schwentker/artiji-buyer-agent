import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createSellerStub } from "../seller/seller-stub.js";

class FakeStripeClient {
  constructor() { this.requestCount = 0; }
  async createAndConfirm() {
    this.requestCount += 1;
    return { id: "pi_mcp_agent_demo", status: "succeeded", created: 1787980000 };
  }
}

async function startServer(context) {
  const stripeClient = new FakeStripeClient();
  const seller = createSellerStub({
    stripeSecretKey: "sk_test_mcp_agent_demo",
    stripeClient
  });
  const server = createMcpHttpServer({
    seller,
    agentBridge: true,
    enforceSessions: true,
    autoCompleteDelayMs: 0
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    seller.close();
  });
  return { baseUrl, stripeClient };
}

async function post(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function initialize(baseUrl) {
  const response = await post(baseUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "contract-client", version: "0.1.0" }
    }
  });
  const sessionId = response.headers.get("mcp-session-id");
  const body = await response.json();
  return { response, sessionId, body };
}

test("MCP Streamable HTTP initializes a session and exposes the agent tool catalog", async (context) => {
  const { baseUrl } = await startServer(context);
  const initialized = await initialize(baseUrl);

  assert.equal(initialized.response.status, 200);
  assert.ok(initialized.sessionId);
  assert.equal(initialized.body.result.protocolVersion, "2025-06-18");
  assert.equal(initialized.body.result.serverInfo.name, "artiji-buyer-agent-mcp");
  assert.ok(initialized.body.result.capabilities.experimental["xyz.artiji/commerce"]);
  assert.ok(initialized.body.result.capabilities.experimental["io.modelcontextprotocol/tasks"]);

  const sessionHeaders = {
    "Mcp-Session-Id": initialized.sessionId,
    "Mcp-Protocol-Version": "2025-06-18"
  };
  const notification = await post(baseUrl, {
    jsonrpc: "2.0",
    method: "notifications/initialized"
  }, sessionHeaders);
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");

  const listed = await post(baseUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }, sessionHeaders);
  const listedBody = await listed.json();
  assert.deepStrictEqual(
    listedBody.result.tools.map(({ name }) => name),
    ["inspect_offer", "order_reading", "get_order_status"]
  );
  const orderTool = listedBody.result.tools.find(({ name }) => name === "order_reading");
  assert.equal(orderTool.annotations.readOnlyHint, false);
  assert.equal(orderTool._meta["xyz.artiji/commerce"].price.amountMinor, 15000);
  assert.equal(orderTool._meta["io.modelcontextprotocol/tasks"].taskSupport, "required");
});

test("MCP agent tools inspect, order once, and return a receipt-correlated artifact", async (context) => {
  const { baseUrl, stripeClient } = await startServer(context);
  const { sessionId } = await initialize(baseUrl);
  const sessionHeaders = {
    "Mcp-Session-Id": sessionId,
    "Mcp-Protocol-Version": "2025-06-18"
  };
  await post(baseUrl, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionHeaders);

  const offerResponse = await post(baseUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "inspect_offer", arguments: {} }
  }, sessionHeaders);
  const offer = (await offerResponse.json()).result;
  assert.equal(offer.structuredContent.terms.price.display, "$150.00 USD");
  assert.equal(offer.isError, false);

  const orderRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "order_reading",
      arguments: { syntheticSubject: "trueforge-demo-founder" }
    }
  };
  const ordered = (await (await post(baseUrl, orderRequest, sessionHeaders)).json()).result;
  const replayed = (await (await post(baseUrl, orderRequest, sessionHeaders)).json()).result;
  assert.equal(ordered.structuredContent.taskId, replayed.structuredContent.taskId);
  assert.equal(ordered.structuredContent.receipt.reference, "pi_mcp_agent_demo");
  assert.equal(stripeClient.requestCount, 1);

  const status = (await (await post(baseUrl, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "get_order_status",
      arguments: { taskId: ordered.structuredContent.taskId }
    }
  }, sessionHeaders)).json()).result;
  const task = status.structuredContent.task;
  assert.equal(task.status, "completed");
  assert.equal(task.result.structuredContent.artifact.orderReference, ordered.structuredContent.receipt.reference);
  assert.equal(status.content.some(({ type }) => type === "resource_link"), true);

  const artifact = await fetch(task.result.structuredContent.artifact.url);
  assert.equal(artifact.status, 200);
  assert.match(await artifact.text(), /Synthetic Deep Reflection/);
});

test("MCP transport rejects invalid sessions and explains browser GET requests", async (context) => {
  const { baseUrl } = await startServer(context);
  const missingSession = await post(baseUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });
  assert.equal(missingSession.status, 400);
  assert.equal((await missingSession.json()).error.code, -32000);

  const browserGet = await fetch(`${baseUrl}/mcp`);
  assert.equal(browserGet.status, 405);
  assert.match((await browserGet.json()).error, /protocol endpoint/);

  const diagnostics = await fetch(`${baseUrl}/`);
  assert.equal(diagnostics.status, 200);
  assert.match(await diagnostics.text(), /MCP server ready/);

  const blockedOrigin = await post(baseUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bad-origin", version: "1" } }
  }, { Origin: "https://attacker.example" });
  assert.equal(blockedOrigin.status, 403);
});
