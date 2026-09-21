/**
 * 🚨 **매장 제보(신고)** — "내 가게인데 내가 안 올렸다" 를 알릴 수 있는 유일한 창구.
 *
 * ## 왜 필요한가 (2026-09-21 실측으로 확인한 구멍)
 * 되찾기 레일(`/store/find` → `store_ownership_claims`)은 이미 있다. 그런데 그건
 * **사장님이 스스로 유어딜에 와서 매장을 등록하려 할 때만** 만나진다(입구가 `StoreRegisterModal`
 * 의 "이미 등록된 매장입니다" 분기와 중개사가 준 `?code=` 둘뿐이다).
 *
 * 즉 **유어딜에 올 일이 없는 사장님은 자기 가게 이용권이 팔리는 줄도 모른다.** 알게 되더라도
 * 소비자 이용권 상세에 신고 입구가 **0개**였다(실측: 그 파일의 `report` 는 전부 분석용
 * `reportFunnel` 이고 제보와 무관).
 *
 * ## 이 파일이 하는 것 / 안 하는 것
 * - **한다**: 제보를 받아 적고(누가·어느 매장·무슨 사유·연락처), 어드민 큐에 세운다.
 * - **안 한다**: 판매 중지도, 환불도 **자동으로 하지 않는다.**
 *   - 환불은 **머니 경로(등급 C)** 다. 신고 한 건으로 돈이 나가면 안 된다.
 *   - 자동 판매중지도 위험하다 — 악의적 제보 한 건에 멀쩡한 매장이 마비된다.
 *   ⇒ 둘 다 **어드민이 기존 경로로 판단**한다. 여기는 *그 판단이 시작되게* 만드는 일만 한다.
 *
 * ## 🔒 제보 하나 = 행 하나 (머니/정합성 룰 #3)
 * `(seller_id, reporter_key)` **열린 제보 부분 UNIQUE** + `INSERT OR IGNORE`.
 * "이미 있나 SELECT 후 INSERT" 는 동시 요청에서 두 장을 만든다.
 *
 * ## 비로그인도 받는다
 * 사장님은 대개 유어딜 계정이 없다. 계정을 요구하면 이 창구는 있으나 마나다.
 * 대신 **연락처를 필수**로 받고(어드민이 되물어야 하니까), 비로그인 제보는 `reporter_key` 를
 * 연락처로 잡아 같은 번호의 도배를 막는다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type StoreReportStatus = 'open' | 'resolved' | 'dismissed'

/** 제보 사유 — 화면 라벨과 1:1. 새 값을 넣으면 화면·어드민 양쪽을 같이 고칠 것. */
export const STORE_REPORT_REASONS = ['not_my_listing', 'wrong_info', 'closed', 'other'] as const
export type StoreReportReason = (typeof STORE_REPORT_REASONS)[number]

export interface StoreReportRow {
  id: number
  seller_id: number
  product_id: number | null
  reporter_user_id: number | null
  reporter_contact: string
  reason: string
  detail: string | null
  status: string
  decided_by: number | null
  decided_at: string | null
  decision_note: string | null
  created_at: string | null
}

// 🛡️ per-worker 메모이제이션 (per-request DDL 금지 — 머니/정합성 부수 룰)
const _done_ensureReports = new WeakSet<object>()

export async function ensureStoreReports(DB: D1Database): Promise<void> {
  if (_done_ensureReports.has(DB)) return
  _done_ensureReports.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS store_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      product_id INTEGER,
      reporter_user_id INTEGER,
      reporter_key TEXT NOT NULL,
      reporter_contact TEXT NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      decided_by INTEGER,
      decided_at DATETIME,
      decision_note TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    // 멱등의 근거 — 같은 사람이 같은 매장에 열린 제보를 두 장 만들 수 없다.
    await DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_store_reports_open
         ON store_reports(seller_id, reporter_key) WHERE status = 'open'`,
    ).run()
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_store_reports_status ON store_reports(status, created_at)`,
    ).run()
  } catch { /* 권한/레거시 — 호출부는 fail-soft 로 다룬다 */ }
}

export interface SubmitReportResult {
  ok: boolean
  code?: 'BAD_INPUT' | 'BAD_REASON' | 'STORE_NOT_FOUND' | 'DUPLICATE'
  error?: string
  reportId?: number
  /** 사유가 "내 가게인데 내가 안 올림" 이면 되찾기 레일로 이어 준다. */
  claimPath?: string
}

/** 연락처 정규화 — 같은 번호를 다르게 적어 도배하는 것을 막는다(숫자만 남긴다). */
export function reporterKeyOf(contact: string, userId?: number | null): string {
  if (Number.isInteger(userId) && Number(userId) > 0) return `u:${userId}`
  const digits = String(contact || '').replace(/\D/g, '')
  return digits ? `p:${digits}` : `raw:${String(contact || '').trim().toLowerCase()}`
}

export async function submitStoreReport(
  DB: D1Database,
  p: {
    sellerId: number
    productId?: number | null
    userId?: number | null
    contact: string
    reason: string
    detail?: string
  },
): Promise<SubmitReportResult> {
  const sellerId = Number(p.sellerId)
  if (!Number.isInteger(sellerId) || sellerId <= 0) return { ok: false, code: 'BAD_INPUT', error: '매장이 올바르지 않습니다' }

  const contact = String(p.contact || '').trim()
  // 어드민이 되물을 수 없는 제보는 처리가 불가능하다 — 그래서 연락처가 필수다.
  if (contact.length < 5 || contact.length > 120) {
    return { ok: false, code: 'BAD_INPUT', error: '연락처(전화 또는 이메일)를 정확히 적어주세요' }
  }

  const reason = String(p.reason || '').trim()
  if (!(STORE_REPORT_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, code: 'BAD_REASON', error: '제보 사유를 선택해주세요' }
  }

  const detail = String(p.detail || '').trim().slice(0, 1000) || null
  const productId = Number.isInteger(Number(p.productId)) && Number(p.productId) > 0 ? Number(p.productId) : null
  const userId = Number.isInteger(Number(p.userId)) && Number(p.userId) > 0 ? Number(p.userId) : null

  await ensureStoreReports(DB)

  // 존재하지 않는 매장에 제보가 쌓이면 어드민 큐가 쓰레기로 찬다.
  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(sellerId).first<{ id: number }>()
    .catch(() => null)
  if (!seller) return { ok: false, code: 'STORE_NOT_FOUND', error: '해당 매장을 찾을 수 없습니다' }

  const key = reporterKeyOf(contact, userId)
  const res = await DB.prepare(
    `INSERT OR IGNORE INTO store_reports
       (seller_id, product_id, reporter_user_id, reporter_key, reporter_contact, reason, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(sellerId, productId, userId, key, contact, reason, detail).run().catch(() => null)

  const claimPath = reason === 'not_my_listing' ? `/store/find?seller_id=${sellerId}` : undefined

  // changes === 0 = 같은 사람의 열린 제보가 이미 있다. 사용자에겐 성공으로 보여 준다
  // (중복이라고 막으면 "접수가 안 됐나" 하고 다시 누른다). 큐에는 한 장만 남는다.
  if (!res || (res.meta?.changes ?? 0) === 0) {
    return { ok: true, code: 'DUPLICATE', claimPath }
  }
  return { ok: true, reportId: Number(res.meta?.last_row_id) || undefined, claimPath }
}

/**
 * 어드민이 제보를 닫는다. **상태만 바꾼다** — 판매 중지도 환불도 여기서 하지 않는다.
 *
 * `resolved`  = 실제 문제였고 (어드민이 기존 경로로) 조치했다
 * `dismissed` = 문제 없음 / 오인 / 악의적 제보
 *
 * 🔒 CAS 로 닫는다 — 두 어드민이 동시에 눌러도 한 번만 성사되고,
 * 이미 닫힌 제보를 다시 닫아 `decided_by` 가 덮어써지지 않는다(누가 판단했는지가 흐려진다).
 */
export async function decideStoreReport(
  DB: D1Database,
  p: { reportId: number; adminId: number; status: Exclude<StoreReportStatus, 'open'>; note?: string },
): Promise<{ ok: boolean; error?: string }> {
  const id = Number(p.reportId)
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: '제보가 올바르지 않습니다' }
  if (p.status !== 'resolved' && p.status !== 'dismissed') return { ok: false, error: '상태가 올바르지 않습니다' }

  await ensureStoreReports(DB)
  const res = await DB.prepare(
    `UPDATE store_reports
        SET status = ?, decided_by = ?, decided_at = datetime('now'), decision_note = ?
      WHERE id = ? AND status = 'open'`,
  ).bind(p.status, Number(p.adminId) || null, String(p.note || '').slice(0, 500) || null, id)
    .run().catch(() => null)

  if (!res || (res.meta?.changes ?? 0) === 0) return { ok: false, error: '이미 처리된 제보입니다' }
  return { ok: true }
}

/** 어드민 큐 — 열린 제보부터. 매장 이름을 함께 실어 어드민이 따로 찾지 않게 한다. */
export async function listStoreReports(
  DB: D1Database,
  p: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: (StoreReportRow & { store_name: string | null })[]; total: number }> {
  await ensureStoreReports(DB)
  const status = p.status && ['open', 'resolved', 'dismissed'].includes(p.status) ? p.status : 'open'
  const limit = Math.min(Math.max(Number(p.limit) || 50, 1), 200)
  const offset = Math.max(Number(p.offset) || 0, 0)

  const rows = await DB.prepare(
    `SELECT r.*, s.business_name AS store_name
       FROM store_reports r
       LEFT JOIN sellers s ON s.id = r.seller_id
      WHERE r.status = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(status, limit, offset).all<StoreReportRow & { store_name: string | null }>().catch(() => null)

  const cnt = await DB.prepare('SELECT COUNT(*) AS n FROM store_reports WHERE status = ?')
    .bind(status).first<{ n: number }>().catch(() => null)

  return { rows: rows?.results ?? [], total: Number(cnt?.n) || 0 }
}
