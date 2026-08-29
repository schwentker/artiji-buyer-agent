import { once } from "node:events";
import { sha256 } from "../shared/canonical.js";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createSellerStub } from "../seller/seller-stub.js";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const host = option("--host", process.env.ARTIJI_MCP_HOST ?? "127.0.0.1");
const port = Number(option("--port", process.env.ARTIJI_MCP_PORT ?? "8787"));
const dbPath = process.env.ARTIJI_DEMO_DB_PATH ?? ":memory:";
const completionDelayMs = Number(process.env.ARTIJI_DEMO_COMPLETION_MS ?? "750");

if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("INVALID_PORT");
if (!Number.isFinite(completionDelayMs) || completionDelayMs < 0) throw new Error("INVALID_COMPLETION_DELAY");

class DemoStripeClient {
  async createAndConfirm({ externalId }) {
    return {
      id: `pi_demo_${sha256(externalId).slice(0, 24)}`,
      status: "succeeded",
      created: Math.floor(Date.now() / 1000)
    };
  }
}

const seller = createSellerStub({
  stripeSecretKey: "sk_test_trueforge_demo_only",
  stripeClient: new DemoStripeClient(),
  dbPath
});
const server = createMcpHttpServer({
  seller,
  agentBridge: true,
  enforceSessions: true,
  autoCompleteDelayMs: completionDelayMs,
  onEvent(event) {
    process.stdout.write(`MCP_EVIDENCE ${JSON.stringify(event)}\n`);
  }
});

server.listen(port, host);
await once(server, "listening");
const address = server.address();
const actualHost = address.address === "::" ? "127.0.0.1" : address.address;
process.stdout.write(`${JSON.stringify({
  event: "MCP_SERVER_READY",
  diagnostics: `http://${actualHost}:${address.port}/`,
  endpoint: `http://${actualHost}:${address.port}/mcp`,
  transport: "streamable-http",
  testMode: true
})}\n`);

async function shutdown(signal) {
  process.stdout.write(`${JSON.stringify({ event: "MCP_SERVER_STOPPING", signal })}\n`);
  await new Promise((resolve) => server.close(resolve));
  seller.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await shutdown(signal);
    process.exit(0);
  });
}
