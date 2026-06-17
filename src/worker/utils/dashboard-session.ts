/**
 * Dashboard single-session enforcement — 대시보드 단일 세션 강제 (2026-06-17).
 *
 * 목적: 한 대시보드 계정은 한 곳(기기/브라우저)에서만 로그인 유지. 새 기기에서 로그인하면
 *       기존 세션은 다음 요청 때 자동 로그아웃(401). 외부 도매 동업자/어드민 계정 공유·도용 방지.
 *
 * 방식(iat 에포크): 모든 대시보드 토큰에 이미 들어있는 `iat`(발급시각, 초) 를 활용.
 *   - 로그인 시 `dashboard_sessions.min_valid_iat = 로그인 iat` 로 갱신(startDashboardSession).
 *   - 미들웨어/리프레시에서 토큰 iat 가 min_valid_iat 미만이면 거부(isDashboardSessionCurrent).
 *   → 더 늦게 로그인한 세션이 이전 세션을 무효화. payload 구조 변경 불필요(iat 기존 존재).
 *
 * 범위(v1): admin / seller(도매 사장 포함) / supplier 만. agency(멀티 멤버)·wholesale 서브계정
 *   (sub_account_id) 은 토큰 sub 가 부모 ID라 시트별 키가 필요 → v1 제외(정상 동시 직원 오로그아웃 방지).
 *
 * 안전성: 전 함수 fail-soft / fail-open — D1 장애·레거시 토큰(iat 없음)·추적행 없음(롤아웃 전)·
 *   비대상 역할은 모두 '통과' 처리하여 인증 자체를 깨뜨리지 않음.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 단일 세션 강제 대상 대시보드 역할 (멀티시트 agency 는 의도적 제외). */
export const SINGLE_SESSION_ROLES: ReadonlySet<string> = new Set(['admin', 'seller', 'supplier'])

const _ensured = new WeakSet<object>()
async function ensureDashboardSessionsTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS dashboard_sessions (
        account_type  TEXT    NOT NULL,
        account_id    INTEGER NOT NULL,
        min_valid_iat INTEGER NOT NULL DEFAULT 0,
        updated_at    TEXT,
        user_agent    TEXT,
        ip            TEXT,
        PRIMARY KEY (account_type, account_id)
      )`,
    ).run()
  } catch { /* 이미 존재 */ }
}

/**
 * 로그인 시 호출 — 이 로그인(iat)보다 먼저 발급된 동일 계정 토큰을 전부 무효화(단일 세션).
 * @param loginIatSec  발급 토큰의 iat (초). 반드시 토큰 payload.iat 와 동일 값을 넘길 것
 *                     (그래야 방금 발급한 자기 토큰이 거부되지 않음).
 * fail-soft: 세션 추적 실패가 로그인을 막지 않음.
 */
export async function startDashboardSession(
  DB: D1Database,
  role: string,
  accountId: number | string,
  loginIatSec: number,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<void> {
  if (!SINGLE_SESSION_ROLES.has(role)) return
  const id = Number(accountId)
  if (!Number.isFinite(id) || id <= 0) return
  if (!Number.isFinite(loginIatSec)) return
  try {
    await ensureDashboardSessionsTable(DB)
    await DB.prepare(
      `INSERT INTO dashboard_sessions (account_type, account_id, min_valid_iat, updated_at, user_agent, ip)
       VALUES (?, ?, ?, datetime('now'), ?, ?)
       ON CONFLICT(account_type, account_id) DO UPDATE SET
         min_valid_iat = excluded.min_valid_iat,
         updated_at    = excluded.updated_at,
         user_agent    = excluded.user_agent,
         ip            = excluded.ip`,
    ).bind(role, id, Math.floor(loginIatSec), meta?.userAgent ?? null, meta?.ip ?? null).run()
  } catch (e) {
    try { if (typeof console !== 'undefined') console.error('[dashboard-session] start failed (fail-soft):', String(e)) } catch { /* noop */ }
  }
}

/**
 * 미들웨어/리프레시에서 호출 — 토큰 iat 가 현재 유효 세션 경계 이상인지 검사.
 * @returns true = 유효(통과). fail-open: D1 오류 / 추적행 없음 / iat 없는 레거시 토큰 /
 *          비대상 역할 / 서브계정 은 모두 true(인증 보존).
 */
export async function isDashboardSessionCurrent(
  DB: D1Database,
  role: string,
  accountId: number | string,
  tokenIatSec: number | undefined | null,
  opts?: { subAccount?: boolean },
): Promise<boolean> {
  if (opts?.subAccount) return true                 // 멀티시트 서브계정 = v1 제외
  if (!SINGLE_SESSION_ROLES.has(role)) return true  // 비대상(agency/user 등)
  if (typeof tokenIatSec !== 'number') return true  // iat 없는 레거시 토큰 = grandfather
  const id = Number(accountId)
  if (!Number.isFinite(id) || id <= 0) return true
  try {
    await ensureDashboardSessionsTable(DB)
    const row = await DB.prepare(
      `SELECT min_valid_iat FROM dashboard_sessions WHERE account_type = ? AND account_id = ?`,
    ).bind(role, id).first<{ min_valid_iat: number }>()
    if (!row) return true                           // 추적행 없음(롤아웃 전 로그인) = grandfather
    return tokenIatSec >= (Number(row.min_valid_iat) - 1)  // 1초 skew 허용
  } catch {
    return true                                     // fail-open — D1 장애로 대시보드 락아웃 방지
  }
}
