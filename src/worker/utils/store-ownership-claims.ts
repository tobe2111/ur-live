/**
 * 🙋 **내 가게 찾기(소유권 신청)** — 설계 SSOT: `docs/design/store-operator-model.md` §5(a)
 *
 * 대표 확정 2026-09-09: *"지금은 유저가 없어서 지금 하면 좋은 게 아닐까"* → 3단계 착수.
 *
 * ## 무엇을 하나
 * 중개자가 대신 올린 매장의 진짜 사장님이 **사업자등록증을 올려** 자기 매장이라고 신청한다.
 * 어드민이 승인하면 `transferStoreOwnership` 이 주인 자리를 넘긴다(그 함수가 SSOT — 자물쇠·강등·
 * 영입 보상 보존이 전부 거기 있고, 이 파일은 **신청서와 심사 이력**만 다룬다).
 *
 * ## 🔑 사업자번호가 열쇠 — 그런데 자동 승인은 아니다
 * 설계 §5(a) 가 사업자번호로 매장을 찾으라고 한 것은 **찾는 방법**이지 **증명**이 아니다.
 * 사업자번호는 인터넷에 공개돼 있다(2026-08-26 에 그 번호만으로 자동 승인되던 경로를 이미 한 번
 * 막았다 — 그때 승인된 매장이 라이브에 남아 있다). 그래서 여기도 **항상 pending → 사람이 심사**다.
 * 번호 일치 여부는 `bno_match` 로 기록해 어드민에게 *신호*로만 보여준다.
 *
 * ## 🔒 신청 하나 = 행 하나 (머니 룰 #3)
 * `(seller_id, user_id)` 의 **pending 부분 UNIQUE** + `INSERT OR IGNORE` 로 멱등. "이미 있나
 * SELECT 후 INSERT" 는 동시 요청에서 두 장을 만든다.
 *
 * ## ⚠️ 승인 시점에 자물쇠를 다시 본다
 * 신청할 땐 잔액이 0 이어도 심사 중에 매출이 생길 수 있다. 승인은 `transferStoreOwnership` 을
 * 통과해야만 성사되고, 막히면 신청서는 **pending 그대로** 남는다(거절이 아니다 — 마감 후 다시 승인).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { resolveStoreOwnerUserId } from './seller-operators'
import { transferStoreOwnership, type TransferResult } from './store-ownership-transfer'

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface StoreClaimRow {
  id: number
  seller_id: number
  user_id: number
  business_number: string | null
  cert_url: string
  contact_phone: string | null
  note: string | null
  status: string
  bno_match: number | null
  decided_by: number | null
  decided_at: string | null
  decision_reason: string | null
  created_at: string | null
}

// 🛡️ per-worker 메모이제이션 (per-request DDL 금지 — 머니/정합성 부수 룰)
const _done_ensureClaims = new WeakSet<object>()

export async function ensureStoreOwnershipClaims(DB: D1Database): Promise<void> {
  if (_done_ensureClaims.has(DB)) return
  _done_ensureClaims.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS store_ownership_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      business_number TEXT,
      cert_url TEXT NOT NULL,
      contact_phone TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      bno_match INTEGER,
      decided_by INTEGER,
      decided_at DATETIME,
      decision_reason TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    // 멱등의 근거 — 같은 사람이 같은 매장에 대해 열린 신청서를 두 장 만들 수 없다.
    await DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_store_claims_open
         ON store_ownership_claims(seller_id, user_id) WHERE status = 'pending'`,
    ).run()
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_store_claims_status ON store_ownership_claims(status, created_at)`,
    ).run()
  } catch { /* 권한/레거시 — 호출부는 fail-soft 로 다룬다 */ }
}

/** 사업자등록증 사본은 우리 업로드 경로의 것만 받는다(외부 URL 을 심사 화면이 그대로 열지 않게). */
export const BIZ_CERT_PATH = /^\/api\/media\/uploads\/biz-cert\//

export interface SubmitClaimResult {
  ok: boolean
  code?: 'BAD_INPUT' | 'BAD_CERT' | 'STORE_NOT_FOUND' | 'ALREADY_OWNER' | 'DUPLICATE'
  error?: string
  claimId?: number
  bnoMatch?: boolean | null
}

export async function submitStoreClaim(
  DB: D1Database,
  p: { sellerId: number; userId: number; businessNumber?: string; certUrl: string; contactPhone?: string; note?: string },
): Promise<SubmitClaimResult> {
  const sellerId = Number(p.sellerId)
  const userId = Number(p.userId)
  if (!Number.isInteger(sellerId) || sellerId <= 0) return { ok: false, code: 'BAD_INPUT', error: '매장이 올바르지 않습니다' }
  if (!Number.isInteger(userId) || userId <= 0) return { ok: false, code: 'BAD_INPUT', error: '로그인이 필요합니다' }
  const certUrl = String(p.certUrl || '').trim()
  if (!BIZ_CERT_PATH.test(certUrl)) return { ok: false, code: 'BAD_CERT', error: '사업자등록증 사본을 첨부해주세요' }
  const bno = String(p.businessNumber || '').replace(/-/g, '')
  if (bno && !/^\d{10}$/.test(bno)) return { ok: false, code: 'BAD_INPUT', error: '사업자번호는 숫자 10자리입니다' }

  await ensureStoreOwnershipClaims(DB)

  const seller = await DB.prepare('SELECT id, business_number FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ id: number; business_number: string | null }>().catch(() => null)
  if (!seller) return { ok: false, code: 'STORE_NOT_FOUND', error: '매장을 찾을 수 없습니다' }

  // 이미 주인이면 신청서를 만들지 않는다 — 어드민 심사 큐에 할 일 없는 행이 쌓인다.
  const owner = await resolveStoreOwnerUserId(DB, sellerId)
  if (owner !== undefined && owner !== null && Number(owner) === userId) {
    return { ok: false, code: 'ALREADY_OWNER', error: '이미 이 매장의 소유자입니다' }
  }

  const storeBno = String(seller.business_number || '').replace(/-/g, '')
  // 번호가 한쪽이라도 없으면 대조 자체를 못 한다 — 불일치(false)가 아니라 모름(null)이다.
  const bnoMatch: boolean | null = bno && storeBno ? bno === storeBno : null

  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO store_ownership_claims
       (seller_id, user_id, business_number, cert_url, contact_phone, note, status, bno_match)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).bind(
    sellerId, userId, bno || null, certUrl,
    String(p.contactPhone || '').trim().slice(0, 20) || null,
    String(p.note || '').trim().slice(0, 500) || null,
    bnoMatch === null ? null : bnoMatch ? 1 : 0,
  ).run().catch(() => null)

  if (!ins || !(ins.meta?.changes ?? 0)) {
    return { ok: false, code: 'DUPLICATE', error: '이미 심사 중인 신청이 있습니다' }
  }
  return { ok: true, claimId: Number(ins.meta?.last_row_id ?? 0) || undefined, bnoMatch }
}

export interface DecideClaimResult {
  ok: boolean
  code?: 'BAD_INPUT' | 'CLAIM_NOT_FOUND' | 'NOT_PENDING' | 'TRANSFER_BLOCKED'
  error?: string
  transfer?: TransferResult
}

/**
 * 어드민 심사. 승인이면 `transferStoreOwnership` 을 통과해야만 상태를 바꾼다.
 *
 * 🔴 순서가 중요하다 — **이전이 성공한 뒤에** 신청서를 approved 로 찍는다. 반대로 하면
 * 자물쇠에 막혔는데 신청서만 '승인됨'이 되어, 아무도 주인이 안 된 채 큐에서 사라진다.
 */
export async function decideStoreClaim(
  DB: D1Database,
  p: { claimId: number; adminUserId: number; approve: boolean; reason?: string },
): Promise<DecideClaimResult> {
  const claimId = Number(p.claimId)
  if (!Number.isInteger(claimId) || claimId <= 0) return { ok: false, code: 'BAD_INPUT', error: '신청서가 올바르지 않습니다' }
  await ensureStoreOwnershipClaims(DB)

  const claim = await DB.prepare(
    'SELECT id, seller_id, user_id, status FROM store_ownership_claims WHERE id = ? LIMIT 1',
  ).bind(claimId).first<{ id: number; seller_id: number; user_id: number; status: string }>().catch(() => null)
  if (!claim) return { ok: false, code: 'CLAIM_NOT_FOUND', error: '신청서를 찾을 수 없습니다' }
  if (claim.status !== 'pending') return { ok: false, code: 'NOT_PENDING', error: '이미 처리된 신청입니다' }

  const reason = String(p.reason || '').trim().slice(0, 500) || null

  if (!p.approve) {
    await DB.prepare(
      `UPDATE store_ownership_claims
          SET status = 'rejected', decided_by = ?, decided_at = datetime('now'), decision_reason = ?
        WHERE id = ? AND status = 'pending'`,
    ).bind(p.adminUserId || null, reason, claimId).run().catch(() => null)
    return { ok: true }
  }

  const transfer = await transferStoreOwnership(DB, {
    sellerId: claim.seller_id, nextUserId: claim.user_id, actorUserId: p.adminUserId,
  })
  if (!transfer.ok) {
    // 신청서는 pending 그대로 — 마감(정산)만 끝내면 같은 신청서로 다시 승인할 수 있다.
    return { ok: false, code: 'TRANSFER_BLOCKED', error: transfer.error, transfer }
  }

  await DB.prepare(
    `UPDATE store_ownership_claims
        SET status = 'approved', decided_by = ?, decided_at = datetime('now'), decision_reason = ?
      WHERE id = ? AND status = 'pending'`,
  ).bind(p.adminUserId || null, reason, claimId).run().catch(() => null)

  // 같은 매장에 남아 있던 다른 사람의 열린 신청서는 자동 정리한다 — 주인이 정해졌으니 심사할 게 없다.
  await DB.prepare(
    `UPDATE store_ownership_claims
        SET status = 'cancelled', decided_at = datetime('now'),
            decision_reason = '다른 신청이 승인되어 자동 종료'
      WHERE seller_id = ? AND status = 'pending' AND id != ?`,
  ).bind(claim.seller_id, claimId).run().catch(() => null)

  return { ok: true, transfer }
}
