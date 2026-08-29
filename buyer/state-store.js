import { DatabaseSync } from "node:sqlite";

export class BuyerStateStore {
  constructor(dbPath = ":memory:") {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS buyer_purchases (
        session_id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        task_id TEXT NOT NULL,
        payer_material_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  async load(sessionId) {
    const row = this.db.prepare("SELECT * FROM buyer_purchases WHERE session_id = ?").get(sessionId);
    if (!row) return null;
    return {
      idempotencyKey: row.idempotency_key,
      receipt: JSON.parse(row.receipt_json),
      taskId: row.task_id,
      payerMaterial: JSON.parse(row.payer_material_json),
      updatedAt: row.updated_at
    };
  }

  async save(sessionId, state) {
    const updatedAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO buyer_purchases (
        session_id, idempotency_key, receipt_json, task_id, payer_material_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        idempotency_key = excluded.idempotency_key,
        receipt_json = excluded.receipt_json,
        task_id = excluded.task_id,
        payer_material_json = excluded.payer_material_json,
        updated_at = excluded.updated_at
    `).run(
      sessionId,
      state.idempotencyKey,
      JSON.stringify(state.receipt),
      state.taskId,
      JSON.stringify(state.payerMaterial),
      updatedAt
    );
    return this.load(sessionId);
  }

  close() {
    this.db.close();
  }
}
