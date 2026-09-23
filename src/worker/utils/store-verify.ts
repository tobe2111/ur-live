/**
 * ☎️ **매장 확인 통화 기록 + 신규 매장 노출 유예** (2026-09-21 — 사기 방어 ①②).
 *
 * ## 무엇을 막으려는 건가
 * 사기꾼이 **남의 가게 이름**으로 가입해 이용권을 팔고 사라지는 일. 승인 전 노출은
 * 2026-09-16 에 `approvedSellerProductSql` 로 막았지만, 그건 *어드민이 승인 버튼을 누르기
 * 전까지*만이다. 서류가 그럴듯하면 승인은 난다. 남는 구멍이 둘:
 *   ① 승인 담당자가 **전화 한 통을 걸었는지 아무 데도 안 남는다** — 걸었는지, 뭐라 했는지,
 *      누가 걸었는지. 그래서 분쟁이 나면 "확인했다"는 말만 남는다.
 *   ② 승인되는 **그 순간 메인 피드에 뜬다** — 제보가 들어올 시간이 0초다.
 *
 * ## 이 파일이 하는 것 / 안 하는 것
 * - **한다**: 통화 결과를 적고, 승인 시 *노출 시작 시각*을 찍고, 확인이 끝나면 그 시각을 앞당긴다.
 * - **안 한다**: 판매 중지·환불·정산 **어느 것도 건드리지 않는다.**
 *   통화 결과가 "본인이 아니랍니다" 여도 **자동으로 매장을 끄지 않는다** — 그건 어드민이
 *   기존 정지 경로로 판단할 일이고, 오귀속 한 건에 멀쩡한 가게가 마비되면 안 된다.
 *   (같은 경계를 `store-reports.ts` 가 이미 지킨다. 테스트가 두 파일 모두 고정한다.)
 *
 * ## ⚠️ 노출 유예는 **기본 OFF** 다
 * `platform_settings.store_exposure_grace_hours` 가 없거나 0 이면 마커를 **아예 안 쓴다** ⇒
 * 오늘과 byte-동일하게 동작한다. 노출을 늦추는 건 매출에 닿는 판단이라 **대표가 켠다**(등급 C).
 *
 * ## ⚠️ 재승인(정지 해제)에는 유예를 걸지 않는다
 * `suspended → approved` 는 이미 확인된 가게가 돌아오는 것이다. 여기에 유예를 걸면
 * 사고 수습이 늦어질 뿐 사기를 막지 못한다. 첫 승인(`pending`·`rejected` 에서 올라온 경우)만.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isMobileKr } from '../../shared/store-phone'

/** 통화 결과 — 화면 라벨과 1:1. 새 값을 넣으면 어드민 화면도 같이 고칠 것. */
export const VERIFY_CALL_RESULTS = ['confirmed', 'denied', 'no_answer', 'wrong_number', 'no_phone'] as const
export type VerifyCallResult = (typeof VERIFY_CALL_RESULTS)[number]

/** 이 결과만이 "확인됨" 이다 — 나머지는 전부 다시 걸어야 하는 상태. */
export const VERIFY_CALL_OK: VerifyCallResult = 'confirmed'

export const EXPOSURE_FROM_KEY = 'store_exposure_from'
export const VERIFIED_CALL_AT_KEY = 'store_verified_call_at'

export interface VerifyCallRow {
  id: number
  seller_id: number
  admin_id: number | null
  result: string
  note: string | null
  created_at: string | null
}

const _done = new WeakSet<object>()

export async function ensureStoreVerify(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS store_verify_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      admin_id INTEGER,
      result TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_store_verify_calls_seller ON store_verify_calls(seller_id, created_at DESC)',
    ).run()
    // 노출 마커가 사는 곳 — 이 테이블이 없으면 소비자 피드의 술어가 통째로 깨진다.
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_meta (
      seller_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT (datetime('now')),
      PRIMARY KEY (seller_id, key)
    )`).run()
    await DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_seller_meta_key ON seller_meta(key, seller_id)',
    ).run()
  } catch {
    _done.delete(DB)
  }
}

/** 유예 시간(시간 단위) — 설정이 없거나 숫자가 아니면 0(=OFF). 상한 168h(7일). */
export async function getExposureGraceHours(DB: D1Database): Promise<number> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'store_exposure_grace_hours'")
    .first<{ value: string | null }>()
    .catch(() => null)
  const n = Number(row?.value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(168, Math.floor(n))
}

/**
 * 첫 승인 직후 호출 — 유예가 켜져 있을 때만 노출 시작 시각을 찍는다.
 * 유예 0 이면 **아무것도 쓰지 않는다**(마커가 없으면 술어가 통과시킨다 = 오늘과 동일).
 * fail-soft: 여기서 실패해도 승인 자체는 이미 끝났다.
 */
export async function markExposureGrace(
  DB: D1Database,
  sellerId: number,
  prevStatus: string | null | undefined,
): Promise<number> {
  if (!Number.isInteger(sellerId) || sellerId <= 0) return 0
  if (String(prevStatus || '') === 'suspended') return 0 // 재승인은 유예 없음
  const hours = await getExposureGraceHours(DB)
  if (hours <= 0) return 0
  try {
    await ensureStoreVerify(DB)
    await DB.prepare(
      `INSERT INTO seller_meta (seller_id, key, value, updated_at)
       VALUES (?, ?, datetime('now', ?), datetime('now'))
       ON CONFLICT(seller_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(sellerId, EXPOSURE_FROM_KEY, `+${hours} hours`).run()
  } catch {
    return 0
  }
  return hours
}

/** 유예 해제 — 확인이 끝났으면 지금부터 보인다(마커 삭제). */
export async function clearExposureGrace(DB: D1Database, sellerId: number): Promise<void> {
  if (!Number.isInteger(sellerId) || sellerId <= 0) return
  await ensureStoreVerify(DB)
  await DB.prepare('DELETE FROM seller_meta WHERE seller_id = ? AND key = ?')
    .bind(sellerId, EXPOSURE_FROM_KEY).run().catch(() => null)
}

/**
 * 통화 결과를 적는다. `confirmed` 면 확인 시각을 남기고 **유예를 푼다**.
 * 그 외 결과는 기록만 — 매장 상태를 건드리지 않는다(위 경계 참조).
 */
export async function recordVerifyCall(
  DB: D1Database,
  input: { sellerId: number; adminId?: number | null; result: string; note?: string | null },
): Promise<{ ok: boolean; reason?: string }> {
  const sellerId = Number(input.sellerId)
  if (!Number.isInteger(sellerId) || sellerId <= 0) return { ok: false, reason: 'BAD_SELLER' }
  const result = String(input.result || '')
  if (!(VERIFY_CALL_RESULTS as readonly string[]).includes(result)) return { ok: false, reason: 'BAD_RESULT' }
  const note = String(input.note ?? '').trim().slice(0, 500) || null
  const adminId = Number.isInteger(input.adminId) && Number(input.adminId) > 0 ? Number(input.adminId) : null
  await ensureStoreVerify(DB)
  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(sellerId).first<{ id: number }>()
    .catch(() => null)
  if (!seller) return { ok: false, reason: 'NO_SELLER' }
  await DB.prepare('INSERT INTO store_verify_calls (seller_id, admin_id, result, note) VALUES (?, ?, ?, ?)')
    .bind(sellerId, adminId, result, note).run()
  if (result === VERIFY_CALL_OK) {
    await DB.prepare(
      `INSERT INTO seller_meta (seller_id, key, value, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(seller_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(sellerId, VERIFIED_CALL_AT_KEY).run().catch(() => null)
    await clearExposureGrace(DB, sellerId)
  }
  return { ok: true }
}

export interface VerifyQueueItem {
  seller_id: number
  business_name: string | null
  phone: string | null
  status: string | null
  created_at: string | null
  needs_manual_call: boolean
  verified_call_at: string | null
  exposure_from: string | null
  last_result: string | null
  last_called_at: string | null
}

/**
 * 확인 통화가 필요한 매장 큐 — 승인됐는데 아직 `confirmed` 통화가 없는 곳.
 * 정렬은 **위험한 순**: 유예가 아직 안 끝난 곳(=방금 승인) → 번호가 휴대폰이 아닌 곳 → 최신순.
 */
export async function listVerifyQueue(
  DB: D1Database,
  opts: { limit?: number; offset?: number; includeDone?: boolean } = {},
): Promise<VerifyQueueItem[]> {
  await ensureStoreVerify(DB)
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 30))
  const offset = Math.max(0, Number(opts.offset) || 0)
  const doneFilter = opts.includeDone ? '' : 'AND mv.value IS NULL'
  const { results } = await DB.prepare(
    `SELECT s.id AS seller_id, s.business_name, s.phone, s.status, s.created_at,
            mv.value AS verified_call_at, me.value AS exposure_from,
            (SELECT c.result FROM store_verify_calls c WHERE c.seller_id = s.id ORDER BY c.id DESC LIMIT 1) AS last_result,
            (SELECT c.created_at FROM store_verify_calls c WHERE c.seller_id = s.id ORDER BY c.id DESC LIMIT 1) AS last_called_at
       FROM sellers s
       LEFT JOIN seller_meta mv ON mv.seller_id = s.id AND mv.key = ?
       LEFT JOIN seller_meta me ON me.seller_id = s.id AND me.key = ?
      WHERE COALESCE(s.status, '') IN ('approved', 'active')
        ${doneFilter}
      ORDER BY (me.value IS NOT NULL) DESC, s.id DESC
      LIMIT ? OFFSET ?`,
  ).bind(VERIFIED_CALL_AT_KEY, EXPOSURE_FROM_KEY, limit, offset)
    .all<Omit<VerifyQueueItem, 'needs_manual_call'>>()
    .catch(() => ({ results: [] as Array<Omit<VerifyQueueItem, 'needs_manual_call'>> }))
  return (results || []).map((r) => ({ ...r, needs_manual_call: !isMobileKr(r.phone) }))
}

/** 매장 1곳의 통화 이력 — 어드민 상세용. */
export async function listVerifyCalls(DB: D1Database, sellerId: number): Promise<VerifyCallRow[]> {
  if (!Number.isInteger(sellerId) || sellerId <= 0) return []
  await ensureStoreVerify(DB)
  const { results } = await DB.prepare(
    'SELECT id, seller_id, admin_id, result, note, created_at FROM store_verify_calls WHERE seller_id = ? ORDER BY id DESC LIMIT 50',
  ).bind(sellerId).all<VerifyCallRow>().catch(() => ({ results: [] as VerifyCallRow[] }))
  return results || []
}
