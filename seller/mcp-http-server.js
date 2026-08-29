import { createServer } from "node:http";

export function createMcpHttpServer({ seller }) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/mcp") {
      response.writeHead(404).end();
      return;
    }

    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    try {
      if (rpc.method === "tools/call" && rpc.params?.name === "order_reading") {
        const result = await seller.purchase({
          ...rpc.params.arguments,
          _meta: rpc.params._meta,
          jsonRpcId: rpc.id
        });
        response.writeHead(result.httpStatus, { "Content-Type": "application/json" });
        response.end(result.rawBody);
        return;
      }
      if (rpc.method === "tasks/get") {
        const body = seller.getTask(rpc.params?.taskId, rpc.id);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body ?? {
          jsonrpc: "2.0",
          id: rpc.id,
          error: { code: -32001, message: "Task not found" }
        }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "Method not found" } }));
    } catch (error) {
      const code = error.code === "IDEMPOTENCY_CONFLICT" ? -32043 : -32603;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code, message: error.message } }));
    }
  });
}
