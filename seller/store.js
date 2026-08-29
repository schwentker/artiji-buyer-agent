import { randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "../shared/canonical.js";

export class IdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
    this.code = "IDEMPOTENCY_CONFLICT";
  }
}

export class SellerStore {
  constructor(dbPath = ":memory:") {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        challenge_id TEXT NOT NULL UNIQUE,
        challenge_json TEXT NOT NULL,
        stripe_idempotency_key TEXT NOT NULL UNIQUE,
        payment_intent_id TEXT UNIQUE,
        response_json TEXT,
        state TEXT NOT NULL CHECK (state IN ('challenged', 'paid')),
        UNIQUE (merchant_id, idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
        status TEXT NOT NULL CHECK (status IN ('working', 'completed', 'failed', 'cancelled')),
        artifact_id TEXT,
        artifact_url TEXT,
        CHECK (status != 'completed' OR (artifact_id IS NOT NULL AND artifact_url IS NOT NULL))
      );
      CREATE TABLE IF NOT EXISTS receipts (
        order_id INTEGER PRIMARY KEY REFERENCES orders(id),
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id),
        receipt_json TEXT NOT NULL
      );
    `);
  }

  transaction(work) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  reserve({ merchantId, idempotencyKey, requestFingerprint, challengeFactory }) {
    return this.transaction(() => {
      const existing = this.db.prepare(
        "SELECT * FROM orders WHERE merchant_id = ? AND idempotency_key = ?"
      ).get(merchantId, idempotencyKey);
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) throw new IdempotencyConflictError();
        return existing;
      }

      const challenge = challengeFactory(randomUUID());
      const stripeIdempotencyKey = `artiji-buyer-${sha256(`${merchantId}:${idempotencyKey}`)}`;
      this.db.prepare(`
        INSERT INTO orders (
          merchant_id, idempotency_key, request_fingerprint, challenge_id,
          challenge_json, stripe_idempotency_key, state
        ) VALUES (?, ?, ?, ?, ?, ?, 'challenged')
      `).run(
        merchantId,
        idempotencyKey,
        requestFingerprint,
        challenge.id,
        JSON.stringify(challenge),
        stripeIdempotencyKey
      );
      return this.db.prepare("SELECT * FROM orders WHERE id = last_insert_rowid()").get();
    });
  }

  finalizePaid({ orderId, paymentIntent, receiptFactory, responseFactory }) {
    return this.transaction(() => {
      const order = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.response_json) return order.response_json;

      const taskId = randomBytes(32).toString("base64url");
      this.db.prepare("INSERT INTO tasks (task_id, order_id, status) VALUES (?, ?, 'working')")
        .run(taskId, orderId);
      const receipt = receiptFactory({ taskId, challengeId: order.challenge_id, paymentIntent });
      this.db.prepare("INSERT INTO receipts (order_id, task_id, receipt_json) VALUES (?, ?, ?)")
        .run(orderId, taskId, JSON.stringify(receipt));
      const responseJson = responseFactory({ taskId, receipt });
      this.db.prepare(`
        UPDATE orders
        SET payment_intent_id = ?, response_json = ?, state = 'paid'
        WHERE id = ?
      `).run(paymentIntent.id, responseJson, orderId);
      return responseJson;
    });
  }

  getTask(taskId) {
    const row = this.db.prepare(`
      SELECT t.*, r.receipt_json
      FROM tasks t
      JOIN receipts r ON r.task_id = t.task_id
      WHERE t.task_id = ?
    `).get(taskId);
    if (!row) return null;
    return {
      taskId: row.task_id,
      status: row.status,
      pollUri: `/tasks/${row.task_id}`,
      ...(row.artifact_id ? { artifact: { id: row.artifact_id, url: row.artifact_url } } : {}),
      receipt: JSON.parse(row.receipt_json)
    };
  }

  evidence() {
    return {
      orders: Number(this.db.prepare("SELECT COUNT(*) AS count FROM orders").get().count),
      paymentIntents: Number(this.db.prepare("SELECT COUNT(payment_intent_id) AS count FROM orders").get().count),
      tasks: Number(this.db.prepare("SELECT COUNT(*) AS count FROM tasks").get().count),
      receipts: Number(this.db.prepare("SELECT COUNT(*) AS count FROM receipts").get().count)
    };
  }

  close() {
    this.db.close();
  }
}
