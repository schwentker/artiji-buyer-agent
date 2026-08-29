# TrueForge harness scaffold

P1 verified TrueForge `0.1.4` in local mode with the official CLI. It started on localhost with SQLite and its API documentation returned HTTP 200. No model provider, MCP connection, or production deployment was configured.

Run it with Node 20 or later:

```sh
npx @truefoundry/trueforge --port 8790
```

The buyer adapter is [`../buyer/harness-session.js`](../buyer/harness-session.js). It keeps only commerce-specific state and approval ports; TrueForge owns sessions, the human-checkpoint UI, and MCP transport configuration. P2 supplies discovery and approval behavior; P3 is the first payment phase.
