/**
 * 💸 **에이전시 몫 — 2단계: 유어딜이 걷어서 지급한다** (2026-10-31 대표 승인 "4번 승인도 해줄게",
 * 2026-11-01 `AskUserQuestion` "지금 만들고 꺼 두기 (추천)") — 게이트 `agency_share_payout_enabled` **기본 OFF**.
 *
 * 결재 `docs/decisions/2026-10-11-agency-model-email-only.md` 규칙 1~3 그대로:
 *   - 규칙 1: 에이전시가 **자기 링크**로 판 건은 에이전시 몫만 붙고 소개비는 안 붙는다(`isOwnAgencyReferral`).
 *   - 규칙 2: 유어딜 고정 상한 없음 — 바닥은 하나, 에이전시 몫이 매장 몫(90%)을 못 넘는다(`AGENCY_SHARE_PCT_MAX`).
 *   - 규칙 3: 기간 없음 — 사장님이 끊으면(맡은 기간이 닫히면) **다음 판매부터** 안 붙고, 붙은 몫은 그대로다.
 *
 * ## 귀속 = 판 순간에 그 이용권을 맡고 있던 에이전시
 * 성과표와 **같은 기준**이다(`channel-sales.ts` 의 맡은 기간). 열린 기간(`ended_at IS NULL`)이 있는 이용권만,
 * 그리고 그 에이전시의 맡김(`agency_store_links`)이 active 일 때만 붙는다. % 는 판매 시각의 % (`agency_share_terms`).
 *
 * ## 🔴 재원은 매장 몫이다 — 유어딜 수수료를 건드리지 않는다
 * 원장 `seller:{id}` → `agencyacct:{id}`(아래 `agencyLedgerAccount` — 자동 정산 집계 밖). 중개사 몫(`broker-share.ts`)과 같은 성질이라 예산 아비터 대상이 아니다.
 * 한 주문에 에이전시 몫이 붙으면 옛 중개사 몫은 **붙지 않는다**(같은 매장 몫을 두 번 떼지 않는다 — 호출부 순서).
 *
 * ## 머니 룰
 *   #1 claim-before-credit · #3 멱등: `agency_share_credits(order_id)` UNIQUE + `INSERT OR IGNORE` 를 먼저 하고,
 *      `changes = 1` 일 때만 원장을 쓴다(결제 확정 경로가 둘 — 딜 /join · 카드 confirm-toss).
 *   #2 적립-역전 대칭: 환불·만료는 `clawbackAgencyShare`(이용권 비례) — `clawbackVoucherCommission` 이 부른다.
 *
 * ## 정산 분기(3단계) — `planAgencyPayout`
 *   사업자(`agency_accounts.kind='business'`) = 원천징수 없음, **에이전시가 유어딜에 세금계산서**를 발행한다.
 *   개인(`kind='individual'`) = 사업소득 3.3% 원천징수(`WITHHOLDING_RATES.business_income` — 상수 직접 곱셈 금지).
 *   지급 신청은 성숙분(`available_at` 지남)만, 지급 자체(송금)는 어드민이 한다 — 자동 송금 없음.
 *
 * ## OFF 일 때
 * 모든 진입점이 즉시 no-op 이다. 이 표는 생기지 않고 원장도 안 쓴다 — 종전과 byte-동일(매장이 직접 송금).
 * 켜는 것은 대표이고 선행은 `docs/STAGING_CHECKLIST.md` **S-AGENCYSHARE** 실결제다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureLedgerTable, recordLedger, sellerLedgerAccount } from './ledger'
import { WITHHOLDING_RATES } from './tax-withholding'
import { AGENCY_SHARE_PCT_MAX, sharePctAtSaleSql } from '../../features/agency-console/api/agency-share'

export const AGENCY_SHARE_GATE = 'agency_share_payout_enabled'
export const AGENCY_SHARE_EVENT = 'agency_share'
export const AGENCY_SHARE_REVERSAL_EVENT = 'agency_share_reversal'
/** 한 번에 신청할 수 있는 최소 금액(송금 수수료보다 작은 지급을 막는다). */
export const AGENCY_PAYOUT_MIN = 10_000

/**
 * 🔴 `agency:` 가 아니라 `agencyacct:` — 두 이유.
 *   ① 주간 자동 정산(`payout-account.ts` `payoutCreditWhere`)이 `agency:%` 를 **집계해 지급**한다 → 같은 몫을
 *      그 cron 과 이 파일의 지급 신청이 **두 번** 낸다. ② 그 `agency:N` 의 N 은 일몰된 옛 `agencies` 번호라,
 *      새 `agency_accounts` 번호와 겹치면 **남의 계좌**로 간다(에러 0). 지급은 이 파일의 신청 경로 하나로만.
 */
export const agencyLedgerAccount = (agencyId: number) => `agencyacct:${agencyId}`

export async function isAgencySharePayoutEnabled(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(AGENCY_SHARE_GATE).first<{ value: string }>().catch(() => null)
  return String(row?.value) === 'true'
}

const _ensured = new WeakSet<object>()
export async function ensureAgencyShareTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  // 원장 표가 먼저 — 역전 UNIQUE 인덱스가 그 표에 걸린다(없으면 batch 전체가 실패해 적립 표도 안 생긴다).
  await ensureLedgerTable(DB)
  await DB.batch([
    // 주문당 1행. 권위 출처 — 잔액은 이 표를 status 별로 합해서 읽는다(따로 저장하지 않는다 → 어긋날 수 없다).
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_share_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_number TEXT,
      gross_amount INTEGER NOT NULL,
      share_pct REAL NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      available_at TEXT NOT NULL,
      payout_id INTEGER,
      clawback_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_share_credits_order ON agency_share_credits(order_id)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_share_credits_agency ON agency_share_credits(agency_id, status)'),
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_share_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      gross_amount INTEGER NOT NULL,
      withholding_amount INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL,
      tax_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      requested_by_staff_id INTEGER,
      paid_at TEXT,
      paid_by_admin_id INTEGER,
      memo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    // 에이전시당 처리 중 신청은 하나 — 두 번 눌러 같은 몫을 두 번 묶지 않는다.
    DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_share_payouts_open ON agency_share_payouts(agency_id) WHERE status = 'requested'"),
    DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_agency_share_reversal
         ON ledger_entries(reference_id) WHERE event_type = '${AGENCY_SHARE_REVERSAL_EVENT}'`,
    ),
  ])
  _ensured.add(DB)
}

/** 순수 — 적립액. 0·음수·비정상은 0. 몫은 매장 몫 상한을 넘지 않게 한 번 더 자른다. */
export function calcAgencyShareAmount(grossAmount: number, pct: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || !Number.isFinite(pct) || pct <= 0) return 0
  return Math.floor(grossAmount * Math.min(pct, AGENCY_SHARE_PCT_MAX) / 100)
}

/** 판매 순간 그 이용권을 맡은 에이전시(열린 기간 + active 맡김)와 그 시각의 % — 없으면 null. */
export async function findAgencyForSale(
  DB: D1Database, sellerId: number, productId: number,
): Promise<{ agencyId: number; pct: number } | null> {
  const row = await DB.prepare(
    `SELECT pr.agency_id AS agency_id,
            ${sharePctAtSaleSql('pr.seller_id', 'pr.agency_id', 'now_')} AS pct
       FROM agency_product_periods pr
       JOIN (SELECT datetime('now') AS created_at) now_
       JOIN agency_store_links l ON l.seller_id = pr.seller_id AND l.agency_id = pr.agency_id AND l.status = 'active'
      WHERE pr.product_id = ? AND pr.seller_id = ? AND pr.ended_at IS NULL
      LIMIT 1`,
  ).bind(productId, sellerId).first<{ agency_id: number; pct: number | null }>().catch(() => null)
  if (!row || !(Number(row.agency_id) > 0)) return null
  return { agencyId: Number(row.agency_id), pct: Number(row.pct) || 0 }
}

/**
 * 규칙 1 — 소개 링크(`ref` = users.id)의 주인이 **그 이용권을 맡은 에이전시의 직원**이면 true.
 * 그 판매에는 에이전시 몫만 붙고 소개비는 붙지 않는다. 게이트 OFF 면 언제나 false(종전과 동일).
 */
export async function isOwnAgencyReferral(
  DB: D1Database, refUserId: string | number | null | undefined, sellerId: number, productId: number,
): Promise<boolean> {
  const uid = Number(refUserId)
  if (!Number.isFinite(uid) || uid <= 0) return false
  if (!(await isAgencySharePayoutEnabled(DB))) return false
  const ag = await findAgencyForSale(DB, sellerId, productId)
  if (!ag) return false
  const staff = await DB.prepare(
    "SELECT 1 FROM agency_staff WHERE agency_id = ? AND user_id = ? AND status = 'active' LIMIT 1",
  ).bind(ag.agencyId, uid).first().catch(() => null)
  return !!staff
}

export interface CreditAgencyShareInput {
  sellerId: number
  orderId: number
  orderNumber: string
  productId: number
  totalAmount: number
  refundWindowDays: number
}

/**
 * 결제 확정 때 부른다. 게이트 OFF · 맡은 에이전시 없음 · % 0 · 중복이면 `credited: 0`.
 * fail-soft — 결제를 막지 않는다. `matched` 가 true 면 이 판매는 에이전시 판매다(옛 중개사 몫을 붙이지 않는다).
 */
export async function creditAgencyShare(
  DB: D1Database, p: CreditAgencyShareInput,
): Promise<{ credited: number; agencyId: number | null; matched: boolean }> {
  const none = { credited: 0, agencyId: null, matched: false }
  try {
    if (!(await isAgencySharePayoutEnabled(DB))) return none
    if (!Number.isFinite(p.orderId) || p.orderId <= 0) return none
    const ag = await findAgencyForSale(DB, p.sellerId, p.productId)
    if (!ag) return none
    const amount = calcAgencyShareAmount(p.totalAmount, ag.pct)
    if (amount <= 0) return { credited: 0, agencyId: ag.agencyId, matched: true }
    await ensureAgencyShareTables(DB)
    const availableAt = new Date(Date.now() + Math.max(0, p.refundWindowDays) * 86400_000).toISOString()
    // 머니 룰 #1·#3 — 선점(UNIQUE)이 먼저, 원장은 선점에 성공한 쪽만.
    const ins = await DB.prepare(
      `INSERT OR IGNORE INTO agency_share_credits
         (agency_id, seller_id, product_id, order_id, order_number, gross_amount, share_pct, amount, status, available_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).bind(ag.agencyId, p.sellerId, p.productId, p.orderId, p.orderNumber, Math.floor(p.totalAmount), ag.pct, amount, availableAt).run()
    if (!ins.meta?.changes) return { credited: 0, agencyId: ag.agencyId, matched: true }
    await recordLedger(DB, {
      event_type: AGENCY_SHARE_EVENT,
      reference_id: p.orderNumber,
      amount,
      debit_account: sellerLedgerAccount(p.sellerId),
      credit_account: agencyLedgerAccount(ag.agencyId),
      metadata: { order_id: p.orderId, product_id: p.productId, share_pct: ag.pct, available_at: availableAt },
    })
    return { credited: amount, agencyId: ag.agencyId, matched: true }
  } catch (e) {
    console.error('[agency-share] credit failed', e)
    return none
  }
}

/**
 * 환불·만료 — 이 이용권 몫만큼(주문 안 남은 장 수로 나눈 비례) 되돌린다. 미지급분(pending·available)만.
 * 이미 지급 신청(requested)·지급(paid)된 몫은 건드리지 않는다 — 돈이 묶였거나 나갔다(회수 정책은 별건).
 * 원장 역전 참조 `agencyshare:{creditId}:v{voucherId}` 는 UNIQUE 라 같은 이용권은 한 번만 되돌린다.
 */
export async function clawbackAgencyShare(
  DB: D1Database, p: { orderId: number | null; voucherId: number; denom: number; reason: string },
): Promise<number> {
  if (!p.orderId) return 0
  try {
    const row = await DB.prepare(
      `SELECT id, agency_id, seller_id, amount, order_number FROM agency_share_credits
        WHERE order_id = ? AND status IN ('pending', 'available')`,
    ).bind(p.orderId).first<{ id: number; agency_id: number; seller_id: number; amount: number; order_number: string | null }>()
    if (!row || !(row.amount > 0)) return 0
    const share = Math.min(row.amount, Math.max(1, Math.floor(row.amount / Math.max(1, p.denom))))
    const remaining = row.amount - share
    // 금액 CAS — 읽은 값 그대로일 때만 깎는다(동시 환불 두 건이 같은 몫을 두 번 못 깎는다).
    const upd = await DB.prepare(
      `UPDATE agency_share_credits
          SET amount = ?, status = CASE WHEN ? <= 0 THEN 'clawed_back' ELSE status END,
              clawback_reason = ?, updated_at = datetime('now')
        WHERE id = ? AND amount = ? AND payout_id IS NULL`,
    ).bind(Math.max(0, remaining), remaining, p.reason, row.id, row.amount).run()
    if (!upd.meta?.changes) return 0
    await ensureAgencyShareTables(DB)
    await recordLedger(DB, {
      event_type: AGENCY_SHARE_REVERSAL_EVENT,
      reference_id: `agencyshare:${row.id}:v${p.voucherId}`,
      amount: share,
      debit_account: agencyLedgerAccount(row.agency_id),
      credit_account: sellerLedgerAccount(row.seller_id),
      metadata: { order_id: p.orderId, voucher_id: p.voucherId, reason: p.reason, original_ref: row.order_number },
    }).catch((e) => console.error('[agency-share] reversal ledger failed', e))
    return share
  } catch (e) {
    console.error('[agency-share] clawback failed', e)
    return 0
  }
}

export interface AgencyShareBalance { pending: number; available: number; requested: number; paid: number }

/** 잔액 — 권위 출처(`agency_share_credits`)를 그때그때 합한다. 성숙 = available_at 이 지난 pending/available. */
export async function readAgencyShareBalance(DB: D1Database, agencyId: number): Promise<AgencyShareBalance> {
  const r = await DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN payout_id IS NULL AND status IN ('pending','available') AND available_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN payout_id IS NULL AND status IN ('pending','available') AND available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN amount ELSE 0 END), 0) AS available,
       COALESCE(SUM(CASE WHEN status = 'requested' THEN amount ELSE 0 END), 0) AS requested,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid
     FROM agency_share_credits WHERE agency_id = ?`,
  ).bind(agencyId).first<AgencyShareBalance>().catch(() => null)
  return { pending: Number(r?.pending) || 0, available: Number(r?.available) || 0, requested: Number(r?.requested) || 0, paid: Number(r?.paid) || 0 }
}

export type AgencyTaxMode = 'tax_invoice' | 'withholding_3_3'

/** 순수 — 정산 분기. 사업자 = 세금계산서(공제 0) · 개인 = 사업소득 3.3%(원 미만 버림, 국세청 관행). */
export function planAgencyPayout(kind: string | null | undefined, gross: number): {
  taxMode: AgencyTaxMode; gross: number; withholding: number; net: number
} {
  const g = Math.max(0, Math.floor(Number(gross) || 0))
  if (kind === 'individual') {
    const withholding = Math.floor(g * WITHHOLDING_RATES.business_income)
    return { taxMode: 'withholding_3_3', gross: g, withholding, net: g - withholding }
  }
  return { taxMode: 'tax_invoice', gross: g, withholding: 0, net: g }
}

/**
 * 지급 신청 — 성숙분을 신청 한 건에 묶는다. 처리 중 신청이 있으면 막는다(UNIQUE).
 * 묶기는 `payout_id IS NULL` 조건으로만 해서, 그 사이 환불로 회수된 몫은 안 묶이고 합계는 실제 묶인 것으로 다시 잰다.
 */
export async function requestAgencyPayout(
  DB: D1Database, agencyId: number, staffId: number | null,
): Promise<{ ok: true; payoutId: number; gross: number; withholding: number; net: number; taxMode: AgencyTaxMode } | { ok: false; error: string }> {
  if (!(await isAgencySharePayoutEnabled(DB))) return { ok: false, error: '아직 유어딜 지급을 쓰지 않아요. 매장과 직접 정산해 주세요.' }
  await ensureAgencyShareTables(DB)
  const bal = await readAgencyShareBalance(DB, agencyId)
  if (bal.available < AGENCY_PAYOUT_MIN) return { ok: false, error: `지급 신청은 ${AGENCY_PAYOUT_MIN.toLocaleString('ko-KR')}원부터 할 수 있어요.` }
  const acct = await DB.prepare('SELECT kind FROM agency_accounts WHERE id = ?').bind(agencyId).first<{ kind: string }>().catch(() => null)
  let payoutId: number
  try {
    const ins = await DB.prepare(
      "INSERT INTO agency_share_payouts (agency_id, gross_amount, net_amount, tax_mode, requested_by_staff_id) VALUES (?, 0, 0, 'pending', ?)",
    ).bind(agencyId, staffId).run()
    payoutId = Number(ins.meta?.last_row_id)
  } catch {
    return { ok: false, error: '처리 중인 지급 신청이 있어요. 끝난 뒤 다시 신청해 주세요.' }
  }
  await DB.prepare(
    `UPDATE agency_share_credits SET payout_id = ?, status = 'requested', updated_at = datetime('now')
      WHERE agency_id = ? AND payout_id IS NULL AND status IN ('pending','available')
        AND available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).bind(payoutId, agencyId).run()
  const sum = await DB.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM agency_share_credits WHERE payout_id = ?')
    .bind(payoutId).first<{ s: number }>()
  const plan = planAgencyPayout(acct?.kind, Number(sum?.s) || 0)
  if (plan.gross <= 0) {
    // 그 사이 다른 신청·환불이 다 가져갔다 — 빈 신청을 남기지 않는다.
    await DB.prepare("UPDATE agency_share_payouts SET status = 'rejected', memo = 'empty', updated_at = datetime('now') WHERE id = ?").bind(payoutId).run()
    return { ok: false, error: '신청할 수 있는 금액이 없어요.' }
  }
  await DB.prepare(
    "UPDATE agency_share_payouts SET gross_amount = ?, withholding_amount = ?, net_amount = ?, tax_mode = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(plan.gross, plan.withholding, plan.net, plan.taxMode, payoutId).run()
  return { ok: true, payoutId, ...plan }
}

/** 어드민이 송금을 마친 뒤 — 신청(requested)일 때만 paid 로(CAS). 묶인 몫도 함께 paid. */
export async function markAgencyPayoutPaid(DB: D1Database, payoutId: number, adminId: number, memo?: string): Promise<boolean> {
  await ensureAgencyShareTables(DB)
  const upd = await DB.prepare(
    "UPDATE agency_share_payouts SET status = 'paid', paid_at = datetime('now'), paid_by_admin_id = ?, memo = ?, updated_at = datetime('now') WHERE id = ? AND status = 'requested'",
  ).bind(adminId, memo ?? null, payoutId).run()
  if (!upd.meta?.changes) return false
  await DB.prepare("UPDATE agency_share_credits SET status = 'paid', updated_at = datetime('now') WHERE payout_id = ?").bind(payoutId).run()
  return true
}

/** 어드민이 반려 — 묶인 몫을 풀어 다시 신청할 수 있게(CAS). */
export async function rejectAgencyPayout(DB: D1Database, payoutId: number, adminId: number, memo?: string): Promise<boolean> {
  await ensureAgencyShareTables(DB)
  const upd = await DB.prepare(
    "UPDATE agency_share_payouts SET status = 'rejected', paid_by_admin_id = ?, memo = ?, updated_at = datetime('now') WHERE id = ? AND status = 'requested'",
  ).bind(adminId, memo ?? null, payoutId).run()
  if (!upd.meta?.changes) return false
  await DB.prepare("UPDATE agency_share_credits SET status = 'available', payout_id = NULL, updated_at = datetime('now') WHERE payout_id = ?").bind(payoutId).run()
  return true
}
