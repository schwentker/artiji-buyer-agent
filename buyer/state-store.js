/**
 * Persistence boundary for a TrueForge-backed buyer session. P3 replaces this
 * interface with a durable store; no purchase handler is implemented in P1.
 */
export class BuyerStateStore {
  async load(_sessionId) {
    throw new Error("NOT_IMPLEMENTED: durable buyer session loading begins in P3");
  }

  async save(_sessionId, _state) {
    throw new Error("NOT_IMPLEMENTED: durable buyer session persistence begins in P3");
  }
}
