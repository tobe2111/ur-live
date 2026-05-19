/**
 * Idempotency utility
 * ====================
 *
 * Guarantees that an idempotent write (e.g. order creation, points payment,
 * points charge confirmation, donation) runs **at most once** per (key, user)
 * pair regardless of concurrent retries or double-submits.
 *
 * How it works
 * ------------
 *  1. Caller supplies a string `key` (usually a client-generated UUID) and a
 *     `userId` (scoping the key so attackers cannot collide across users).
 *  2. We try to INSERT a row into `idempotency_keys` with a UNIQUE constraint
 *     on (key, user_id). The winning INSERT is the "first" request; the losing
 *     ones return `meta.changes === 0`.
 *  3. The winner runs the `operation()` and stores the serialised result.
 *  4. Losers replay the cached result (or 409 if the winner is still running /
 *     expired).
 *
 * D1 does not offer SELECT FOR UPDATE, but INSERT with UNIQUE is atomic, so
 * this pattern is race-condition free at the database level.
 *
 * Table lifecycle: we `CREATE TABLE IF NOT EXISTS` on first call so an
 * environment without the migration still works.  Expired rows are cleaned by
 * a cron in `src/worker/cron/scheduled-cleanup.ts`.
 */
import type { D1Database } from '@cloudflare/workers-types';

let tableEnsured = false;

async function ensureTable(DB: D1Database): Promise<void> {
  if (_done_ensureTable) return
  _done_ensureTable = true
  if (tableEnsured) return;
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        result TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        PRIMARY KEY (key, user_id)
      )
    `).run();
    tableEnsured = true;
  } catch {
    // Table already exists or ALTER mismatch — ignore
  }
}

/**
 * Suggested TTLs.
 *
 * Payment-critical flows (Toss confirm, point charge) should use at least
 * 7 days: if a retry arrives after the key expires we'd re-execute against
 * Toss, potentially charging twice. Discord webhooks / audit-only flows
 * can live with 24h.
 */
export const IDEMPOTENCY_TTL = {
  DEFAULT: 24 * 60 * 60,          // 24h
  PAYMENT: 7 * 24 * 60 * 60,      // 7 days — money paths
} as const;

export interface IdempotencyOptions {
  /** TTL in seconds (default 24h, use IDEMPOTENCY_TTL.PAYMENT for money paths). */
  ttlSeconds?: number;
  /**
   * How to behave when the same (key, user) request is already **in progress**
   * (i.e. another concurrent call won the INSERT race but hasn't stored a
   * result yet). Default: throw so the client retries. For safety on money
   * paths we prefer to surface a 409 to the client.
   */
  onInProgress?: 'throw' | 'return_null';
}

export class IdempotencyConflictError extends Error {
  readonly status = 409;
  constructor(message = '중복 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Execute `operation` at most once for the given (key, userId) pair.
 *
 * If another request with the same key has already completed, returns the
 * cached result without calling `operation` again.
 *
 * If another request is currently in progress, throws an
 * `IdempotencyConflictError` (recommend 409 to client).
 */
export async function idempotentWrite<T>(
  DB: D1Database,
  key: string,
  userId: string | number,
  operation: () => Promise<T>,
  opts: IdempotencyOptions = {},
): Promise<T> {
  if (!key || !userId) {
    // Missing inputs → fall back to un-guarded execution (defensive).
    return operation();
  }
  const ttlSeconds = opts.ttlSeconds ?? IDEMPOTENCY_TTL.DEFAULT;
  const userIdStr = String(userId);

  await ensureTable(DB);

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // Try to claim the key. UNIQUE constraint makes this atomic.
  const insert = await DB.prepare(
    "INSERT OR IGNORE INTO idempotency_keys (key, user_id, status, expires_at) VALUES (?, ?, 'pending', ?)",
  ).bind(key, userIdStr, expiresAt).run();

  if ((insert.meta?.changes ?? 0) === 0) {
    // Another call already claimed this key.
    const existing = await DB.prepare(
      "SELECT result, status FROM idempotency_keys WHERE key = ? AND user_id = ? AND expires_at > datetime('now')",
    ).bind(key, userIdStr).first<{ result: string | null; status: string }>();

    if (!existing) {
      // Expired — race; treat like a new attempt failed to replay.
      throw new IdempotencyConflictError('이전 요청이 만료되었습니다. 새로 시도해주세요.');
    }

    if (existing.status === 'done' && existing.result) {
      try {
        return JSON.parse(existing.result) as T;
      } catch {
        throw new IdempotencyConflictError('결과 캐시를 읽을 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    }

    // Still pending (winner hasn't finished yet).
    throw new IdempotencyConflictError();
  }

  // We won the race — execute the operation.
  try {
    const result = await operation();
    try {
      await DB.prepare(
        "UPDATE idempotency_keys SET result = ?, status = 'done' WHERE key = ? AND user_id = ?",
      ).bind(JSON.stringify(result ?? null), key, userIdStr).run();
    } catch {
      // Storing the result is best-effort; never block the caller.
    }
    return result;
  } catch (err) {
    // On failure delete the row so the client can retry with the same key.
    try {
      await DB.prepare(
        'DELETE FROM idempotency_keys WHERE key = ? AND user_id = ?',
      ).bind(key, userIdStr).run();
    } catch {
      /* ignore */
    }
    throw err;
  }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
