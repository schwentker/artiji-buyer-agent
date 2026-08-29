# P3 task claim security model

The experiment uses a **high-entropy bearer `taskId`**.

- The seller generates 32 random bytes and encodes them as unpadded base64url (256 bits of entropy).
- Possession of the `taskId` authorizes `tasks/get`. There is no separate identity or proof-of-possession key in this experiment.
- The capability is intentionally transferable: copying it transfers task-read authority. This is explicit behavior, not an accidental property.
- The buyer persists the task ID beside its receipt, logical-purchase idempotency key, and payer material.
- Raw task IDs are forbidden in committed traces and ordinary logs. Evidence uses SHA-256 hashes of task IDs.

Proof-of-possession was rejected for this build because the MPP-over-MCP and MCP Tasks drafts do not define a buyer identity/key binding, and the TrueForge session scaffold has no experiment-owned stable signing key. Inventing one would obscure the cross-spec question this repository measures.

Limitations: the local SQLite buyer store is not encrypted, capability revocation is not implemented, and a leaked task ID grants read access until the local seller is retired. These constraints are acceptable only for the isolated synthetic test-mode experiment.
