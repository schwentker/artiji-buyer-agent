const readline = require("node:readline");

const offer = Object.freeze({
  sku: "individual",
  name: "Deep Reflection",
  price: Object.freeze({ amountMinor: 15000, currency: "USD", display: "$150.00 USD" }),
  fulfillmentMode: "manual-deferred",
  expectedWindow: "3-5 days",
  resultType: "full chart analysis artifact",
  refundPolicy: "full refund if fulfillment cannot be completed",
  cancellationPolicy: "cancellable before payment confirmation",
  testModeOnly: true
});

const inspectOfferTool = Object.freeze({
  name: "inspect_offer",
  title: "Inspect Deep Reflection offer",
  description:
    "Read the complete material terms for the fixed USD 150 Deep Reflection test offer. " +
    "This tool is read-only and never creates an order or payment.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  outputSchema: {
    type: "object",
    properties: {
      sku: { type: "string" },
      name: { type: "string" },
      price: { type: "object" },
      fulfillmentMode: { type: "string" },
      expectedWindow: { type: "string" },
      resultType: { type: "string" },
      refundPolicy: { type: "string" },
      cancellationPolicy: { type: "string" },
      testModeOnly: { type: "boolean" }
    },
    required: [
      "sku",
      "name",
      "price",
      "fulfillmentMode",
      "expectedWindow",
      "resultType",
      "refundPolicy",
      "cancellationPolicy",
      "testModeOnly"
    ]
  }
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  let request;

  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  if (request.id == null) return;

  switch (request.method) {
    case "initialize":
      sendResult(request.id, {
        protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "artiji-commerce", version: "1.0.0" }
      });
      break;
    case "ping":
      sendResult(request.id, {});
      break;
    case "tools/list":
      sendResult(request.id, { tools: [inspectOfferTool] });
      break;
    case "tools/call":
      if (request.params?.name !== "inspect_offer") {
        sendError(request.id, -32602, "Unknown tool");
        break;
      }

      sendResult(request.id, {
        content: [{ type: "text", text: JSON.stringify(offer) }],
        structuredContent: offer,
        isError: false
      });
      break;
    case "resources/list":
      sendResult(request.id, { resources: [] });
      break;
    case "resources/templates/list":
      sendResult(request.id, { resourceTemplates: [] });
      break;
    case "prompts/list":
      sendResult(request.id, { prompts: [] });
      break;
    default:
      sendError(request.id, -32601, "Method not found");
  }
});
