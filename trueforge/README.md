# TrueForge live agent demo

The repository now exposes a discoverable Streamable HTTP MCP server for a live TrueForge agent. TrueForge owns the model loop, session UI, connector transport, and visible human approval; the Artiji server owns offer disclosure, idempotent test payment, deferred task state, and receipt/artifact correlation.

Use Node 22.14 or later.

## 1. Start the MCP server

From the repository root:

```sh
npm run demo:mcp
```

Expected endpoint: `http://127.0.0.1:8787/mcp`.

- Open `http://127.0.0.1:8787/` for a human-readable diagnostic.
- Open `http://127.0.0.1:8787/health` for machine-readable health.
- A browser `GET http://127.0.0.1:8787/mcp` returns `405` by design. MCP clients connect with JSON-RPC `POST` requests.

The runnable server implements `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`, session termination, and the experimental raw `tasks/get` path. It advertises three ordinary tools so a generic agent harness can act:

| Tool | Effect | Approval expectation |
| --- | --- | --- |
| `inspect_offer` | Returns all six `xyz.artiji/commerce` material-term categories | Read-only |
| `order_reading` | Executes the synthetic test-payment challenge/retry and creates one durable task | Human approval required |
| `get_order_status` | Wraps authoritative `tasks/get` and returns the correlated artifact | Read-only |

## 2. Start TrueForge

```sh
npx @truefoundry/trueforge@latest --port 8790
```

Open `http://localhost:8790`.

1. **Settings → Models:** configure the hackathon model provider.
2. **Settings → Connectors → Add MCP Server:**

   - Name: `artiji-commerce`
   - URL: `http://127.0.0.1:8787/mcp`
   - Authentication: none

3. In chat, select the model and attach `artiji-commerce` under **Tools → Connectors**.
4. Turn preload on so the three tool schemas are visible immediately.
5. Save the configured chat as `artiji-buyer-agent`.

`order_reading` publishes `readOnlyHint: false`; TrueForge's default write-tool policy should pause before calling it. For a guaranteed literal policy, create or update the agent through the TrueForge API with:

```json
{
  "mcp_servers": [
    {
      "name": "artiji-commerce",
      "enable_tools": ["@all"],
      "require_approval_for_tools": ["order_reading"],
      "preload": true
    }
  ]
}
```

## 3. Demo prompt

```text
Purchase the $150 Deep Reflection service for synthetic subject demo-founder.
Explain every material term and ask before spending. After approval, track the
deferred task until it completes and verify that the artifact belongs to the
payment receipt.
```

Expected visible sequence:

1. The model calls `inspect_offer` and summarizes USD 150, 3–5 days, result type, refund, and cancellation terms.
2. The harness presents an **Allow / Deny** checkpoint before `order_reading`.
3. After **Allow**, the MCP server creates exactly one fake test payment and one deferred task.
4. The model calls `get_order_status` and receives a local resource link whose `orderReference` matches the receipt.
5. The MCP terminal prints redacted `MCP_EVIDENCE` events without the raw bearer task ID.

The demo auto-completes after 750 ms. Set `ARTIJI_DEMO_COMPLETION_MS` to change it. Set `ARTIJI_DEMO_DB_PATH` to a local SQLite path if state must survive restarting the demo server; the default is in-memory.

## Boundary

The MCP server exposes `xyz.artiji/commerce` and `io.modelcontextprotocol/tasks` as experimental capability/tool metadata and keeps raw `tasks/get` available. The ordinary `get_order_status` tool is a compatibility bridge because TrueForge exposes MCP tools to the model but is not claimed to natively understand those draft extensions.

The separate [`../buyer/harness-session.js`](../buyer/harness-session.js) remains the deterministic buyer-state adapter used by the crash/recovery evidence suite. The live TrueForge path does not claim to reproduce the suite's real `SIGKILL` demonstration inside the chat UI.
