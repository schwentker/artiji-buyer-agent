import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const serverPath = new URL("../trueforge/artiji-cloud-stdio.cjs", import.meta.url);

function readJsonLines(stream, expectedCount) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const messages = [];

    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;

      while (buffer.includes("\n")) {
        const newline = buffer.indexOf("\n");
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        messages.push(JSON.parse(line));
        if (messages.length === expectedCount) resolve(messages);
      }
    });
    stream.on("error", reject);
  });
}

test("TrueFoundry STDIO entrypoint initializes, discovers inspect_offer, and returns fixed terms", async (t) => {
  const source = await readFile(serverPath, "utf8");
  const child = spawn(process.execPath, ["-e", source, "artiji-commerce"], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  t.after(() => child.kill());

  const responsesPromise = readJsonLines(child.stdout, 3);
  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" }
      }
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "inspect_offer", arguments: {} }
    }
  ];

  for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);

  const responses = await responsesPromise;
  assert.equal(responses[0].result.serverInfo.name, "artiji-commerce");
  assert.equal(responses[1].result.tools.length, 1);
  assert.equal(responses[1].result.tools[0].name, "inspect_offer");
  assert.equal(responses[2].result.structuredContent.price.amountMinor, 15000);
  assert.equal(responses[2].result.structuredContent.testModeOnly, true);
  assert.equal(responses[2].result.isError, false);

  child.stdin.end();
  await once(child, "exit");
});
