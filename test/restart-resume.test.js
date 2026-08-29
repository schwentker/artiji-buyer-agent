import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { BuyerStateStore } from "../buyer/state-store.js";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";
import { createMcpHttpServer } from "../seller/mcp-http-server.js";
import { createOperatorFixture } from "../seller/operator-fixture.js";
import { createSellerStub } from "../seller/seller-stub.js";
import { withTasksCapability } from "../shared/mcp-tasks.js";

const TASK_TIMESTAMP = "2026-08-28T20:00:00.000Z";

function polledTask({ taskId, status, receipt, artifact }) {
  return {
    result: {
      resultType: "complete",
      taskId,
      status,
      createdAt: TASK_TIMESTAMP,
      lastUpdatedAt: TASK_TIMESTAMP,
      ttlMs: null,
      ...(artifact ? {
        result: {
          content: [{ type: "resource_link", name: artifact.id, uri: artifact.url }],
          structuredContent: { artifact },
          isError: false
        }
      } : {}),
      _meta: { "org.paymentauth/receipt": receipt }
    }
  };
}

class FakeStripeClient {
  constructor() {
    this.requestCount = 0;
  }

  async createAndConfirm() {
    this.requestCount += 1;
    return { id: "pi_p4_cold_restart", status: "succeeded", created: 1787977200 };
  }
}

function readJsonLine(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline >= 0) resolve(JSON.parse(stdout.slice(0, newline)));
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (stdout.includes("\n") || signal === "SIGKILL") return;
      reject(new Error(`buyer child exited ${code ?? signal}: ${stderr}`));
    });
  });
}

test("P4 contract: kill after payment, cold restart, authoritative polling, and correlated artifact completion", async (context) => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "artiji-p4-test-"));
  const buyerDbPath = join(tempDirectory, "buyer.sqlite");
  const payments = new FakeStripeClient();
  const seller = createSellerStub({
    stripeSecretKey: "sk_test_contract_fixture",
    stripeClient: payments,
    dbPath: join(tempDirectory, "seller.sqlite")
  });
  const operator = createOperatorFixture({ seller });
  const server = createMcpHttpServer({ seller });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    seller.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });
  const sellerUrl = `http://127.0.0.1:${server.address().port}/mcp`;
  const childScript = new URL("../scripts/p4-buyer-process.js", import.meta.url);

  const purchaseProcess = spawn(process.execPath, [childScript.pathname, "purchase", sellerUrl, buyerDbPath], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const paidEvidence = await readJsonLine(purchaseProcess);
  const exitPromise = once(purchaseProcess, "exit");
  purchaseProcess.kill("SIGKILL");
  const [, killSignal] = await exitPromise;
  assert.equal(paidEvidence.event, "PAID_PERSISTED");
  assert.equal(killSignal, "SIGKILL");

  const coldStore = new BuyerStateStore(buyerDbPath);
  const persisted = await coldStore.load("p4-cold-restart-session");
  coldStore.close();
  assert.equal(persisted.receipt.reference, "pi_p4_cold_restart");

  const resumeProcess = spawn(process.execPath, [childScript.pathname, "resume", sellerUrl, buyerDbPath], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const resumeExitPromise = once(resumeProcess, "exit");
  const completion = new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(operator.publishArtifact({
          taskId: persisted.taskId,
          id: "artifact-p4-fixture",
          url: "https://artifacts.example.test/p4-fixture",
          orderReference: persisted.receipt.reference
        }));
      } catch (error) {
        reject(error);
      }
    }, 150);
  });
  const resumed = await readJsonLine(resumeProcess);
  await completion;
  const [resumeCode] = await resumeExitPromise;

  assert.equal(resumeCode, 0);
  assert.equal(resumed.event, "COLD_RESUME_COMPLETED");
  assert.equal(resumed.resumedFromPersistence, true);
  assert.equal(resumed.authoritativeSource, "tasks/get");
  assert.equal(resumed.notificationsAuthoritative, false);
  assert.ok(resumed.pollCount >= 2);
  assert.equal(resumed.artifact.orderReference, persisted.receipt.reference);
  assert.equal(resumed.receiptReference, persisted.receipt.reference);
  assert.equal(payments.requestCount, 1);

  console.log(`P4_EVIDENCE ${JSON.stringify({
    paidProcessKilledWith: killSignal,
    purchaseProcessPid: purchaseProcess.pid,
    resumeProcessPid: resumeProcess.pid,
    taskIdSha256: paidEvidence.taskIdSha256,
    receiptReference: resumed.receiptReference,
    coldResume: true,
    authoritativeSource: resumed.authoritativeSource,
    notificationsAuthoritative: resumed.notificationsAuthoritative,
    pollCount: resumed.pollCount,
    artifact: resumed.artifact,
    stripeRequests: payments.requestCount
  })}`);
});

test("P4 contract: seller cannot publish completed with a null artifact URL", async (context) => {
  const payments = new FakeStripeClient();
  const seller = createSellerStub({ stripeSecretKey: "sk_test_contract_fixture", stripeClient: payments });
  context.after(() => seller.close());
  const request = {
    syntheticSubject: "null-artifact-fixture",
    idempotencyKey: "null-artifact-key-000000000001",
    jsonRpcId: 1,
    _meta: withTasksCapability({
      "org.paymentauth/credential": { paymentMethod: "pm_card_visa" }
    })
  };
  await seller.purchase({ ...request, _meta: withTasksCapability() });
  const paid = await seller.purchase(request);
  const taskId = paid.body.result.taskId;

  assert.throws(() => seller.completeTask(taskId, {
    id: "artifact-null-url",
    url: null,
    orderReference: "pi_p4_cold_restart"
  }), /ARTIFACT_REQUIRED_BEFORE_COMPLETION/);
  assert.equal(seller.getTask(taskId).result.status, "working");
});

test("P4 contract: buyer rejects completed state without artifact correlation", async (context) => {
  const stateStore = new BuyerStateStore();
  context.after(() => stateStore.close());
  const receipt = {
    status: "succeeded",
    method: "stripe",
    timestamp: "2026-08-28T20:00:00.000Z",
    reference: "pi_expected_order",
    challengeId: "challenge-p4-fixture"
  };
  await stateStore.save("correlation-fixture", {
    idempotencyKey: "correlation-key-00000000000001",
    receipt,
    taskId: "0123456789012345678901234567890123456789012",
    payerMaterial: { paymentMethod: "pm_card_visa" }
  });
  const buyer = new TrueForgeBuyerSession({ sessionId: "correlation-fixture", stateStore });

  await assert.rejects(() => buyer.resumePurchase({
    maxPolls: 1,
    getTask: async (taskId) => polledTask({
      taskId,
      status: "completed",
      receipt,
      artifact: { id: "artifact", url: null, orderReference: "pi_wrong_order" }
    })
  }), /COMPLETED_TASK_MISSING_ARTIFACT/);

  await assert.rejects(() => buyer.resumePurchase({
    maxPolls: 1,
    getTask: async (taskId) => polledTask({
      taskId,
      status: "completed",
      receipt,
      artifact: {
        id: "artifact",
        url: "https://artifacts.example.test/wrong",
        orderReference: "pi_wrong_order"
      }
    })
  }), /ARTIFACT_ORDER_MISMATCH/);
});

test("P4 contract: notifications are wake hints and every tasks/get receipt remains authoritative", async (context) => {
  const stateStore = new BuyerStateStore();
  context.after(() => stateStore.close());
  const receipt = {
    status: "succeeded",
    method: "stripe",
    timestamp: "2026-08-28T20:00:00.000Z",
    reference: "pi_notification_fixture",
    challengeId: "challenge-notification-fixture"
  };
  const taskId = "notification-task-012345678901234567890123456789";
  await stateStore.save("notification-fixture", {
    idempotencyKey: "notification-key-000000000000001",
    receipt,
    taskId,
    payerMaterial: { paymentMethod: "pm_card_visa" }
  });
  const buyer = new TrueForgeBuyerSession({ sessionId: "notification-fixture", stateStore });
  let pollCount = 0;
  const result = await buyer.resumePurchase({
    maxPolls: 2,
    getTask: async () => {
      pollCount += 1;
      return polledTask({
        taskId,
        status: pollCount === 1 ? "working" : "completed",
        receipt,
        ...(pollCount === 2 ? {
          artifact: {
            id: "authoritative-artifact",
            url: "https://artifacts.example.test/authoritative",
            orderReference: receipt.reference
          }
        } : {})
      });
    },
    waitForWakeHint: async () => ({
      status: "completed",
      artifact: { id: "untrusted-notification-artifact", url: null }
    })
  });
  assert.equal(result.artifact.id, "authoritative-artifact");
  assert.equal(result.notificationsAuthoritative, false);
  assert.equal(result.pollCount, 2);

  const mismatchedReceipt = { ...receipt, reference: "pi_wrong_receipt" };
  await assert.rejects(() => buyer.resumePurchase({
    maxPolls: 1,
    getTask: async () => polledTask({
      taskId,
      status: "working",
      receipt: mismatchedReceipt
    })
  }), /RECEIPT_CORRELATION_MISMATCH/);
});
