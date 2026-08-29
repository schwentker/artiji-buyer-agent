import { sha256 } from "../shared/canonical.js";
import { BuyerStateStore } from "../buyer/state-store.js";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";
import { taskRoutingHeaders, withTasksCapability } from "../shared/mcp-tasks.js";

const [mode, sellerUrl, buyerDbPath] = process.argv.slice(2);
const sessionId = "p4-cold-restart-session";
const idempotencyKey = "p4-restart-key-000000000000001";
const payerMaterial = { paymentMethod: "pm_card_visa" };
const stateStore = new BuyerStateStore(buyerDbPath);
const buyer = new TrueForgeBuyerSession({ sessionId, stateStore });

async function rpc(body, headers = {}) {
  const response = await fetch(sellerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { httpStatus: response.status, body: await response.json() };
}

if (mode === "purchase") {
  const args = { syntheticSubject: "p4-synthetic-fixture", idempotencyKey };
  const challenge = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "order_reading", arguments: args, _meta: withTasksCapability() }
  });
  if (challenge.body.error?.code !== -32042) throw new Error("PAYMENT_CHALLENGE_EXPECTED");
  const paid = await rpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "order_reading",
      arguments: args,
      _meta: withTasksCapability({ "org.paymentauth/credential": payerMaterial })
    }
  });
  await buyer.persistPaidResult({ idempotencyKey, response: paid.body, payerMaterial });
  process.stdout.write(`${JSON.stringify({
    event: "PAID_PERSISTED",
    httpStatus: paid.httpStatus,
    taskIdSha256: sha256(paid.body.result.taskId),
    receiptReference: paid.body.result._meta["org.paymentauth/receipt"].reference
  })}\n`);
  setInterval(() => {}, 1000);
} else if (mode === "resume") {
  let rpcId = 10;
  const result = await buyer.resumePurchase({
    getTask: async (taskId) => (await rpc({
      jsonrpc: "2.0",
      id: rpcId++,
      method: "tasks/get",
      params: { taskId }
    }, taskRoutingHeaders(taskId))).body,
    waitForWakeHint: async () => new Promise((resolve) => setTimeout(resolve, 50))
  });
  process.stdout.write(`${JSON.stringify({
    event: "COLD_RESUME_COMPLETED",
    resumedFromPersistence: result.resumedFromPersistence,
    authoritativeSource: result.authoritativeSource,
    notificationsAuthoritative: result.notificationsAuthoritative,
    pollCount: result.pollCount,
    artifact: result.artifact,
    receiptReference: result.receipt.reference
  })}\n`);
  stateStore.close();
} else {
  stateStore.close();
  throw new Error("MODE_MUST_BE_PURCHASE_OR_RESUME");
}
