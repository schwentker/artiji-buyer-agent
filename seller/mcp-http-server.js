import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { COMMERCE_EXTENSION_NAMESPACE } from "../schemas/catalog.js";
import { sha256 } from "../shared/canonical.js";
import {
  TASKS_EXTENSION_ID,
  withTasksCapability
} from "../shared/mcp-tasks.js";

const PAYMENT_CHALLENGE_META = "org.paymentauth/challenge";
const PAYMENT_CREDENTIAL_META = "org.paymentauth/credential";
const PAYMENT_RECEIPT_META = "org.paymentauth/receipt";
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  DEFAULT_PROTOCOL_VERSION,
  "2025-03-26",
  "2026-07-28"
]);
const MAX_BODY_BYTES = 1024 * 1024;

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) }
  };
}

function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    ...headers
  });
  response.end(JSON.stringify(body));
}

function writeHtml(response, status, html, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    ...headers
  });
  response.end(html);
}

function requestPath(request) {
  return new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds 1 MiB");
      error.httpStatus = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON request body");
    error.httpStatus = 400;
    throw error;
  }
}

function negotiateProtocol(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.has(requested)
    ? requested
    : DEFAULT_PROTOCOL_VERSION;
}

function commerceMeta(seller) {
  return {
    [COMMERCE_EXTENSION_NAMESPACE]: seller.extensions[COMMERCE_EXTENSION_NAMESPACE]
  };
}

function toolCatalog(seller, { agentBridge }) {
  const nativeOrderTool = seller.tools.find(({ name }) => name === "order_reading");
  const orderInputSchema = agentBridge ? {
    type: "object",
    additionalProperties: false,
    required: ["syntheticSubject"],
    properties: {
      syntheticSubject: {
        type: "string",
        minLength: 1,
        description: "Synthetic demo subject only; never send real birth or customer data."
      },
      idempotencyKey: {
        type: "string",
        minLength: 24,
        description: "Optional logical-purchase key. The server derives a stable session key when omitted."
      }
    }
  } : nativeOrderTool.inputSchema;

  return [
    {
      name: "inspect_offer",
      title: "Inspect Deep Reflection offer",
      description: "Read the complete material terms for the fixed USD 150 Deep Reflection offer. This does not pay or create an order.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: commerceMeta(seller)
    },
    {
      ...nativeOrderTool,
      title: "Order Deep Reflection",
      description: `${nativeOrderTool.description} This is a write operation and must be approved by a human in the agent harness before invocation. Test mode only.`,
      inputSchema: orderInputSchema,
      annotations: {
        ...nativeOrderTool.annotations,
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        ...commerceMeta(seller),
        [TASKS_EXTENSION_ID]: { taskSupport: "required" }
      }
    },
    {
      name: "get_order_status",
      title: "Get deferred order status",
      description: "Read authoritative deferred-task state and the correlated artifact when fulfillment completes.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["taskId"],
        properties: {
          taskId: {
            type: "string",
            minLength: 32,
            description: "Bearer task capability returned by order_reading."
          }
        }
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: { [TASKS_EXTENSION_ID]: { wrapsMethod: "tasks/get" } }
    }
  ];
}

function offerCallResult(seller) {
  const terms = seller.extensions[COMMERCE_EXTENSION_NAMESPACE];
  return {
    content: [{
      type: "text",
      text: [
        `${terms.price.display} for ${seller.offer.resultType}.`,
        `Fulfillment: ${terms.fulfillmentMode}; expected ${terms.expectedWindow}.`,
        `Refund: ${terms.refundPolicy}.`,
        `Cancellation: ${terms.cancellationPolicy}.`
      ].join(" ")
    }],
    structuredContent: {
      sku: seller.offer.sku,
      extension: COMMERCE_EXTENSION_NAMESPACE,
      terms
    },
    _meta: commerceMeta(seller),
    isError: false
  };
}

function taskCallResult(body) {
  const task = body?.result;
  if (!task) {
    return {
      content: [{ type: "text", text: "Task not found." }],
      structuredContent: { status: "not_found" },
      isError: true
    };
  }

  const artifact = task.result?.structuredContent?.artifact;
  return {
    content: [
      {
        type: "text",
        text: artifact
          ? `Task ${task.taskId} completed with artifact ${artifact.id}.`
          : `Task ${task.taskId} is ${task.status}.`
      },
      ...(artifact ? [{
        type: "resource_link",
        name: artifact.id,
        uri: artifact.url,
        description: "Synthetic Deep Reflection artifact correlated to the paid order."
      }] : [])
    ],
    structuredContent: { task },
    _meta: task._meta,
    isError: false
  };
}

function orderCallResult({ paid, challenge }) {
  const task = paid.body.result;
  const receipt = task._meta[PAYMENT_RECEIPT_META];
  return {
    content: [{
      type: "text",
      text: `Approved test-mode payment ${receipt.reference}; deferred task ${task.taskId} is ${task.status}.`
    }],
    structuredContent: {
      taskId: task.taskId,
      status: task.status,
      receipt,
      ...(challenge ? {
        paymentChallenge: challenge.body.error.data[PAYMENT_CHALLENGE_META][0]
      } : {})
    },
    _meta: {
      [PAYMENT_RECEIPT_META]: receipt,
      [TASKS_EXTENSION_ID]: { resultType: task.resultType }
    },
    isError: false
  };
}

function diagnosticsHtml({ seller, agentBridge }) {
  const tools = toolCatalog(seller, { agentBridge });
  const rows = tools.map((tool) => `<li><code>${tool.name}</code> — ${tool.description}</li>`).join("");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Artiji MCP demo server</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#1d2433}code{background:#f2f4f7;padding:2px 5px;border-radius:4px}.ok{color:#08783e;font-weight:700}</style></head>
<body><p class="ok">● MCP server ready</p><h1>Artiji buyer-agent MCP server</h1>
<p>This page is a human-readable diagnostic. MCP clients connect with Streamable HTTP at <code>POST /mcp</code>.</p>
<h2>Discoverable tools</h2><ul>${rows}</ul>
<h2>Experimental metadata</h2><p><code>${COMMERCE_EXTENSION_NAMESPACE}</code> and <code>${TASKS_EXTENSION_ID}</code></p>
<p><a href="/health">Health JSON</a> · <a href="/mcp">Why /mcp does not render a webpage</a></p></body></html>`;
}

/**
 * Streamable HTTP MCP transport. In agentBridge mode, the standard tool
 * surface adapts the experimental payment/task lifecycle for generic harnesses
 * such as TrueForge while raw tasks/get remains available as extension evidence.
 */
export function createMcpHttpServer({
  seller,
  agentBridge = false,
  enforceSessions = false,
  autoCompleteDelayMs = null,
  onEvent = () => {}
}) {
  const sessions = new Map();
  const startedAt = new Date().toISOString();

  const emit = (event) => onEvent({ timestamp: new Date().toISOString(), ...event });

  const completeDemoTask = (task, host) => {
    const receipt = task._meta[PAYMENT_RECEIPT_META];
    const complete = () => {
      const current = seller.getTask(task.taskId)?.result;
      if (!current || current.status !== "working") return;
      seller.completeTask(task.taskId, {
        id: `artifact-${sha256(task.taskId).slice(0, 16)}`,
        url: `http://${host}/artifacts/${encodeURIComponent(task.taskId)}`,
        orderReference: receipt.reference
      });
      emit({ event: "task_completed", taskIdSha256: sha256(task.taskId) });
    };
    if (autoCompleteDelayMs === null) return;
    if (autoCompleteDelayMs <= 0) complete();
    else setTimeout(complete, autoCompleteDelayMs).unref();
  };

  const executeAgentOrder = async ({ rpc, sessionId, host }) => {
    const syntheticSubject = rpc.params?.arguments?.syntheticSubject;
    if (typeof syntheticSubject !== "string" || syntheticSubject.trim() === "") {
      return {
        content: [{ type: "text", text: "syntheticSubject is required." }],
        isError: true
      };
    }
    const suppliedKey = rpc.params.arguments.idempotencyKey;
    const idempotencyKey = suppliedKey ?? `trueforge-${sha256({ sessionId, syntheticSubject }).slice(0, 48)}`;
    if (idempotencyKey.length < 24) {
      return {
        content: [{ type: "text", text: "idempotencyKey must contain at least 24 characters." }],
        isError: true
      };
    }
    const purchaseRequest = {
      syntheticSubject,
      idempotencyKey,
      jsonRpcId: rpc.id
    };
    const firstResponse = await seller.purchase({
      ...purchaseRequest,
      _meta: withTasksCapability()
    });
    if (firstResponse.body?.result?.taskId) {
      emit({
        event: "order_created",
        replayed: true,
        taskIdSha256: sha256(firstResponse.body.result.taskId),
        receiptReference: firstResponse.body.result._meta[PAYMENT_RECEIPT_META].reference
      });
      return orderCallResult({ paid: firstResponse });
    }
    const challenge = firstResponse;
    if (challenge.body?.error?.code !== -32042) {
      throw new Error("EXPECTED_PAYMENT_CHALLENGE");
    }
    const paid = await seller.purchase({
      ...purchaseRequest,
      _meta: withTasksCapability({
        [PAYMENT_CREDENTIAL_META]: { paymentMethod: "pm_card_visa" }
      })
    });
    if (!paid.body?.result?.taskId) throw new Error("PAID_TASK_NOT_CREATED");
    completeDemoTask(paid.body.result, host);
    emit({
      event: "order_created",
      replayed: paid.replayed,
      taskIdSha256: sha256(paid.body.result.taskId),
      receiptReference: paid.body.result._meta[PAYMENT_RECEIPT_META].reference
    });
    return orderCallResult({ paid, challenge });
  };

  return createServer(async (request, response) => {
    const path = requestPath(request);
    const host = request.headers.host ?? "127.0.0.1";

    if (!isAllowedOrigin(request.headers.origin)) {
      writeJson(response, 403, { error: "Origin not allowed" });
      return;
    }

    if (request.method === "GET" && path === "/") {
      writeHtml(response, 200, diagnosticsHtml({ seller, agentBridge }));
      return;
    }
    if (request.method === "GET" && path === "/health") {
      writeJson(response, 200, {
        ok: true,
        server: "artiji-buyer-agent-mcp",
        startedAt,
        endpoint: "/mcp",
        transport: "streamable-http",
        tools: toolCatalog(seller, { agentBridge }).map(({ name }) => name),
        extensions: [COMMERCE_EXTENSION_NAMESPACE, TASKS_EXTENSION_ID],
        testMode: true
      });
      return;
    }
    if (request.method === "GET" && path.startsWith("/artifacts/")) {
      const taskId = decodeURIComponent(path.slice("/artifacts/".length));
      const task = seller.getTask(taskId)?.result;
      const artifact = task?.result?.structuredContent?.artifact;
      if (!artifact) {
        writeJson(response, 404, { error: "Artifact not found" });
        return;
      }
      writeHtml(response, 200, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Deep Reflection demo artifact</title><body><main><h1>Synthetic Deep Reflection</h1><p>Artifact <code>${artifact.id}</code> was correlated to test payment <code>${artifact.orderReference}</code>.</p><p>This is synthetic hackathon evidence, not an astrological reading or production fulfillment.</p></main></body></html>`);
      return;
    }
    if (request.method === "GET" && path === "/mcp") {
      writeJson(response, 405, {
        error: "MCP Streamable HTTP is a protocol endpoint, not a webpage.",
        connectWith: "POST /mcp",
        diagnostics: "/",
        health: "/health"
      }, { Allow: "POST, DELETE" });
      return;
    }
    if (request.method === "DELETE" && path === "/mcp") {
      const sessionId = request.headers["mcp-session-id"];
      if (sessionId) sessions.delete(sessionId);
      response.writeHead(204, { "Cache-Control": "no-store" }).end();
      return;
    }
    if (request.method !== "POST" || path !== "/mcp") {
      writeJson(response, 404, { error: "Not found" });
      return;
    }
    if (!(request.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
      writeJson(response, 415, { error: "Content-Type must be application/json" });
      return;
    }

    let rpc;
    try {
      rpc = await readJson(request);
    } catch (error) {
      writeJson(response, error.httpStatus ?? 400, jsonRpcError(null, -32700, error.message));
      return;
    }
    if (Array.isArray(rpc) || rpc?.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      writeJson(response, 400, jsonRpcError(rpc?.id, -32600, "Invalid JSON-RPC request"));
      return;
    }

    if (rpc.method === "initialize") {
      const protocolVersion = negotiateProtocol(rpc.params?.protocolVersion);
      const sessionId = randomUUID();
      sessions.set(sessionId, { protocolVersion, initialized: false });
      emit({ event: "initialized", protocolVersion });
      writeJson(response, 200, {
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
            experimental: {
              [COMMERCE_EXTENSION_NAMESPACE]: { version: "0.1.0" },
              [TASKS_EXTENSION_ID]: { version: seller.protocolVersion }
            }
          },
          serverInfo: {
            name: "artiji-buyer-agent-mcp",
            title: "Artiji Buyer Agent MCP Demo",
            version: "0.1.0"
          },
          instructions: "Inspect material terms before ordering. order_reading is test-mode only and requires explicit human approval in the agent harness."
        }
      }, { "Mcp-Session-Id": sessionId });
      return;
    }

    const sessionId = request.headers["mcp-session-id"];
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (enforceSessions && !session) {
      writeJson(response, 400, jsonRpcError(rpc.id, -32000, "Missing or invalid Mcp-Session-Id"));
      return;
    }
    if (request.headers["mcp-protocol-version"] && session && request.headers["mcp-protocol-version"] !== session.protocolVersion) {
      writeJson(response, 400, jsonRpcError(rpc.id, -32001, "Mcp-Protocol-Version does not match the initialized session"));
      return;
    }

    if (rpc.id === undefined || rpc.id === null) {
      if (rpc.method === "notifications/initialized" && session) session.initialized = true;
      emit({ event: "notification", method: rpc.method });
      response.writeHead(202, { "Cache-Control": "no-store" }).end();
      return;
    }

    emit({ event: "request", method: rpc.method, tool: rpc.params?.name });
    try {
      if (rpc.method === "ping") {
        writeJson(response, 200, { jsonrpc: "2.0", id: rpc.id, result: {} });
        return;
      }
      if (rpc.method === "tools/list") {
        writeJson(response, 200, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: { tools: toolCatalog(seller, { agentBridge }) }
        });
        return;
      }
      if (rpc.method === "tools/call" && rpc.params?.name === "inspect_offer") {
        writeJson(response, 200, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: offerCallResult(seller)
        });
        return;
      }
      if (rpc.method === "tools/call" && rpc.params?.name === "order_reading") {
        if (agentBridge) {
          const result = await executeAgentOrder({ rpc, sessionId: sessionId ?? "stateless", host });
          writeJson(response, 200, { jsonrpc: "2.0", id: rpc.id, result });
          return;
        }
        const result = await seller.purchase({
          ...rpc.params.arguments,
          _meta: rpc.params._meta,
          jsonRpcId: rpc.id
        });
        response.writeHead(result.httpStatus, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json"
        });
        response.end(result.rawBody);
        return;
      }
      if (rpc.method === "tools/call" && rpc.params?.name === "get_order_status") {
        const body = seller.getTask(rpc.params?.arguments?.taskId, rpc.id);
        writeJson(response, 200, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: taskCallResult(body)
        });
        return;
      }
      if (rpc.method === "tasks/get") {
        const body = seller.getTask(rpc.params?.taskId, rpc.id);
        writeJson(response, 200, body ?? jsonRpcError(rpc.id, -32001, "Task not found"));
        return;
      }
      writeJson(response, 200, jsonRpcError(rpc.id, -32601, "Method not found"));
    } catch (error) {
      const code = error.code === "IDEMPOTENCY_CONFLICT" ? -32043 : -32603;
      writeJson(response, 200, jsonRpcError(rpc.id, code, error.message));
    }
  });
}
