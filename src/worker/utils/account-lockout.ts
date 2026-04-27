import { swallow } from './swallow';
/**
 * Account Lockout — 연속 로그인 실패 시 계정 일시 잠금
 *
 * Brute force 보호:
 * - 5회 연속 실패 → 15분 잠금
 * - 10회 → 1시간
 * - 20회 → 24시간
 * - 성공 시 카운터 초기화
 *
 * Rate limit 과 병용: rate limit 은 IP 기반, lockout 은 계정 기반.
 * 둘 다 있어야 distributed brute force 방어 가능.
 */

export type UserType = 'user' | 'seller' | 'admin' | 'agency';

async function ensureLockoutTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS account_lockouts (
      user_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_failure_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_type, user_id)
    )
  `).run().catch(swallow('worker:utils:account-lockout'));
}

function lockDurationMs(failureCount: number): number {
  // 🛡️ 2026-04-22: 정책 완화 (5/10/20 → 10/20/30) — 본인 비번 잘못 입력 시 잠금 너무 빠름.
  // brute force 방어 효과는 유지 (10회+ 시 잠금 시작).
  if (failureCount >= 30) return 24 * 60 * 60 * 1000; // 24h
  if (failureCount >= 20) return 60 * 60 * 1000;      // 1h
  if (failureCount >= 10) return 15 * 60 * 1000;      // 15min
  return 0;
}

/**
 * 로그인 시도 전에 호출 — 잠금 상태 확인
 * @returns { locked: true, unlockAt } 또는 { locked: false }
 */
export async function checkLockout(
  DB: D1Database,
  userType: UserType,
  userId: string,
): Promise<{ locked: boolean; unlockAt?: string; reason?: string }> {
  await ensureLockoutTable(DB);
  const row = await DB.prepare(
    'SELECT failure_count, locked_until FROM account_lockouts WHERE user_type = ? AND user_id = ?'
  ).bind(userType, userId).first<{ failure_count: number; locked_until: string | null }>();

  if (!row || !row.locked_until) return { locked: false };

  const unlockTime = new Date(row.locked_until).getTime();
  if (isNaN(unlockTime)) return { locked: false };

  if (Date.now() < unlockTime) {
    return {
      locked: true,
      unlockAt: row.locked_until,
      reason: `${row.failure_count}회 연속 실패로 계정이 일시 잠금되었습니다. 해제 시각: ${row.locked_until}`,
    };
  }
  return { locked: false };
}

/**
 * 로그인 실패 시 호출 — 카운터 증가 + 필요 시 잠금
 */
export async function recordFailure(
  DB: D1Database,
  userType: UserType,
  userId: string,
): Promise<void> {
  await ensureLockoutTable(DB);
  const row = await DB.prepare(
    'SELECT failure_count FROM account_lockouts WHERE user_type = ? AND user_id = ?'
  ).bind(userType, userId).first<{ failure_count: number }>();

  const newCount = (row?.failure_count ?? 0) + 1;
  const lockMs = lockDurationMs(newCount);
  const lockedUntil = lockMs > 0 ? new Date(Date.now() + lockMs).toISOString() : null;

  await DB.prepare(`
    INSERT INTO account_lockouts (user_type, user_id, failure_count, locked_until, last_failure_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_type, user_id) DO UPDATE SET
      failure_count = failure_count + 1,
      locked_until = ?,
      last_failure_at = datetime('now')
  `).bind(userType, userId, newCount, lockedUntil, lockedUntil).run();
}

/**
 * 로그인 성공 시 호출 — 카운터 초기화
 */
export async function clearFailures(
  DB: D1Database,
  userType: UserType,
  userId: string,
): Promise<void> {
  await DB.prepare(
    'DELETE FROM account_lockouts WHERE user_type = ? AND user_id = ?'
  ).bind(userType, userId).run().catch(swallow('worker:utils:account-lockout'));
}
