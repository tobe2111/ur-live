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
 * 범위: 시트(seat)별 단일 세션 — admin / seller / supplier 는 계정 id, agency 멤버는 member_id,
 *   wholesale 서브계정은 sub_account_id 를 시트 키로 사용(deriveDashboardSeat). 같은 회사의 서로 다른
 *   직원(멤버/서브계정)은 각자 시트라 동시 로그인 보존, 같은 시트의 다른 기기만 단일 세션.
 *
 * 안전성: 전 함수 fail-soft / fail-open — D1 장애·레거시 토큰(iat 없음)·추적행 없음(롤아웃 전)·
 *   비대상 역할은 모두 '통과' 처리하여 인증 자체를 깨뜨리지 않음.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 단일 세션 강제 대상 시트 역할(라벨). */
export const SINGLE_SESSION_ROLES: ReadonlySet<string> = new Set([
  'admin', 'seller', 'supplier', 'agency', 'agency_member', 'seller_sub',
])

/**
 * 토큰/세션 payload 에서 단일 세션 '시트(seat)' 키를 도출. 로그인·미들웨어·리프레시가 동일 함수를
 * 써서 키 일치 보장. null = 강제 비대상(user 등).
 *   - sub_account_id (도매 직원)      → ('seller_sub', sub_account_id)
 *   - type='agency' + member_id        → ('agency_member', member_id)
 *   - type='agency' (멤버 없음/카카오)  → ('agency', agencyId)
 *   - type='admin'|'seller'|'supplier' → (type, 계정 id)
 */
export function deriveDashboardSeat(p: {
  type?: unknown; sub?: unknown; userId?: unknown;
  sub_account_id?: unknown; member_id?: unknown;
}): { role: string; id: number } | null {
  const toId = (v: unknown): number => Number(typeof v === 'string' ? v : v as number)
  if (p.sub_account_id != null) {
    const id = toId(p.sub_account_id)
    return Number.isFinite(id) && id > 0 ? { role: 'seller_sub', id } : null
  }
  const type = typeof p.type === 'string' ? p.type : ''
  if (type === 'agency') {
    if (p.member_id != null) {
      const mid = toId(p.member_id)
      if (Number.isFinite(mid) && mid > 0) return { role: 'agency_member', id: mid }
    }
    const aid = toId(p.sub ?? p.userId)
    return Number.isFinite(aid) && aid > 0 ? { role: 'agency', id: aid } : null
  }
  if (type === 'admin' || type === 'seller' || type === 'supplier') {
    const id = toId(p.userId ?? p.sub)
    return Number.isFinite(id) && id > 0 ? { role: type, id } : null
  }
  return null
}

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
): Promise<boolean> {
  if (!SINGLE_SESSION_ROLES.has(role)) return true  // 비대상(user 등)
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
