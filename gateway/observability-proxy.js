import { createServer } from "node:http";
import { sha256 } from "../shared/canonical.js";

function summarize(raw) {
  const body = JSON.parse(raw);
  const summary = {
    jsonrpc: body.jsonrpc,
    id: body.id,
    method: body.method,
    errorCode: body.error?.code,
    paymentHttpStatus: body.error?.data?.httpStatus,
    taskStatus: body.result?.status,
    taskIdSha256: body.result?.taskId ? sha256(body.result.taskId) : undefined,
    receiptReference: body.result?._meta?.["org.paymentauth/receipt"]?.reference,
    challengeId: body.error?.data?.["org.paymentauth/challenge"]?.[0]?.id,
    credentialSeen: Boolean(body.params?._meta?.["org.paymentauth/credential"]),
    paymentSemanticsDecoded: false
  };
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}

export function createObservabilityProxy({ targetUrl, scenario, trace = [] }) {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const requestRaw = Buffer.concat(chunks).toString("utf8");
    const requestBody = summarize(requestRaw);
    const upstreamHeaders = {
      "Content-Type": request.headers["content-type"] ?? "application/json",
      ...(request.headers["mcp-method"] ? { "Mcp-Method": request.headers["mcp-method"] } : {}),
      ...(request.headers["mcp-name"] ? { "Mcp-Name": request.headers["mcp-name"] } : {})
    };
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: requestRaw
    });
    const responseRaw = await upstream.text();
    const responseBody = summarize(responseRaw);
    trace.push({
      scenario,
      sequence: trace.length + 1,
      direction: "client→gateway→seller",
      request: requestBody,
      requestRawSha256: sha256(requestRaw),
      response: responseBody,
      responseRawSha256: sha256(responseRaw),
      upstreamHttpStatus: upstream.status,
      gatewayDecodedPayment: false,
      note: "Transparent MCP proxy; MPP challenge/credential/receipt remain opaque JSON fields."
    });
    response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
    response.end(responseRaw);
  });
}
