import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { captureVectorSet } from "../scripts/p6-vector-fixture.js";
import { sha256 } from "../shared/canonical.js";

test("P6: committed vectors reproduce byte-for-byte", async () => {
  const expected = JSON.parse(await readFile(
    new URL("../vectors/deferred-task-flow.json", import.meta.url),
    "utf8"
  ));
  const actual = await captureVectorSet();

  assert.deepStrictEqual(actual, expected);
  for (const vector of Object.values(actual.vectors)) {
    assert.equal(sha256(vector.request.body), vector.request.sha256);
    assert.equal(sha256(vector.response.body), vector.response.sha256);
    assert.equal(vector.response.status, 200);
  }
  assert.equal(actual.vectors.challenge.response.status, 200);
  assert.equal(JSON.parse(actual.vectors.challenge.response.body).error.data.httpStatus, 402);
  assert.equal(actual.vectors.paidSuccess.request.body, actual.vectors.replay.request.body);
  assert.equal(actual.vectors.paidSuccess.response.body, actual.vectors.replay.response.body);
  assert.equal(actual.fixture.stripeRequests, 1);

  const paidReceipt = JSON.parse(actual.vectors.paidSuccess.response.body)
    .result._meta["org.paymentauth/receipt"];
  for (const name of ["poll", "completed"]) {
    const receipt = JSON.parse(actual.vectors[name].response.body)
      .result._meta["org.paymentauth/receipt"];
    assert.deepStrictEqual(receipt, paidReceipt);
  }
});
