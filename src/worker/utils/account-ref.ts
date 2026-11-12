/**
 * 🔗 **계정이 기억하는 마지막 소개 링크** (2026-11-12 대표 *"모두 확인해봐 계속 진행"* — 다른 기기에서 산 결제도 소개 성과로).
 *
 * 문제: 소개 링크는 그 브라우저에만 저장된다(`affiliate-ref-store`). 폰에서 인플루언서 링크를 눌러 둘러보고 PC 에서 사면
 * PC 브라우저엔 링크가 없어 **무귀속**이었다.
 *
 * 처방: 로그인한 손님이 소개 링크로 들어오면(또는 링크로 들어온 뒤 로그인하면) 계정에 `(소개자, 들어온 시각)` 을 한 줄 남긴다.
 *   - **마지막 링크가 이긴다** — 더 늦은 시각만 덮어쓴다(기기가 여럿이어도 계정 기준 마지막).
 *   - **24시간** — 브라우저 규칙(`REFERRAL_TTL_HOURS`)과 같은 창.
 *   - 결제 때 계정 기록이 살아 있으면 **그것을 먼저** 쓴다. 계정 기록은 기기마다의 링크를 모두 받아 가장 늦은 것을 남기므로
 *     "어느 기기에서든 마지막에 누른 링크" 가 된다. 없으면 종전대로 본문 → 헤더 → 쿠키.
 * 자기 링크·없는 사람 거르기는 결제 경로가 종전대로 한다(`isSelfReferral` + 존재 검증) — 여기서 통과한 값도 거기를 지난다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export const ACCOUNT_REF_TTL_HOURS = 24
const REF_RE = /^\d{1,12}$/

const _ensured = new WeakSet<D1Database>()
export async function ensureAccountRefTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS user_ref_touch (
      user_id TEXT PRIMARY KEY,
      ref_id TEXT NOT NULL,
      at TEXT NOT NULL
    )`).run().catch(() => null)
}

/** 클라가 보낸 '들어온 시각'(ms) → 저장 시각. 미래·24시간 밖·깨진 값은 null(저장 안 함). 순수 함수. */
export function clampTouchAt(clientAtMs: unknown, nowMs: number): string | null {
  const at = Number(clientAtMs)
  const t = Number.isFinite(at) && at > 0 ? Math.min(at, nowMs) : nowMs
  if (nowMs - t > ACCOUNT_REF_TTL_HOURS * 3600_000) return null
  return new Date(t).toISOString().replace('T', ' ').slice(0, 19)
}

export async function recordAccountRef(DB: D1Database, userId: string, refId: unknown, clientAtMs: unknown, nowMs = Date.now()): Promise<boolean> {
  const ref = String(refId ?? '').trim()
  if (!REF_RE.test(ref) || !userId || ref === String(userId)) return false
  const at = clampTouchAt(clientAtMs, nowMs)
  if (!at) return false
  await ensureAccountRefTable(DB)
  const r = await DB.prepare(`INSERT INTO user_ref_touch (user_id, ref_id, at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET ref_id = excluded.ref_id, at = excluded.at WHERE excluded.at >= user_ref_touch.at`)
    .bind(String(userId), ref, at).run().catch(() => null)
  return (r?.meta?.changes ?? 0) > 0
}

/** 24시간 안의 계정 소개자. 없으면 ''. */
export async function readAccountRef(DB: D1Database, userId: string | number | null | undefined, nowMs = Date.now()): Promise<string> {
  if (userId == null || userId === '') return ''
  await ensureAccountRefTable(DB)
  const since = new Date(nowMs - ACCOUNT_REF_TTL_HOURS * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
  const row = await DB.prepare(`SELECT ref_id FROM user_ref_touch WHERE user_id = ? AND at >= ? LIMIT 1`)
    .bind(String(userId), since).first<{ ref_id: string }>().catch(() => null)
  return row?.ref_id && REF_RE.test(row.ref_id) ? row.ref_id : ''
}

/** 결제 경로용 — 계정 기록(기기 무관 마지막 링크)이 있으면 그것, 없으면 종전 출처(본문→헤더→쿠키)에서 고른 값. */
export async function preferAccountRef(DB: D1Database, userId: string | number | null | undefined, picked: string): Promise<string> {
  const acc = await readAccountRef(DB, userId).catch(() => '')
  return acc || picked
}
