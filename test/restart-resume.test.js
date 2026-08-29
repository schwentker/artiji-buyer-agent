import test from "node:test";
import assert from "node:assert/strict";
import { TrueForgeBuyerSession } from "../buyer/harness-session.js";

test("P4 contract: a cold TrueForge buyer session resumes from persisted purchase state only", async () => {
  const restartedBuyer = new TrueForgeBuyerSession({ sessionId: "cold-restart-fixture" });
  const result = await restartedBuyer.resumePurchase();

  assert.equal(result.resumedFromPersistence, true);
  assert.equal(result.authoritativeSource, "tasks/get");
});
