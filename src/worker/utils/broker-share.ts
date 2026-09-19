/**
 * 💸 **중개사 몫 직접 송금** — 결재 `docs/decisions/2026-09-16-broker-payout-model.md` 안 1 의 구현
 * (2026-09-19, 게이트 `broker_share_enabled` **기본 OFF**)
 *
 * ## 무엇이 바뀌나 (켜졌을 때만)
 * 중개 매장(`store_channel='brokered'`)에서 이용권이 팔리면, 매장 등록 때 정한 **중개사 몫 %** 만큼을
 * 매장 몫에서 떼어 **중개사(유저)에게** 적립한다. 적립 레일은 인플루언서와 **같은 것**을 쓴다 —
 * `influencer_attributions(source='broker_share')` + `influencer_balances` + 원장(seller → influencer:{uid}).
 * 그래서 성숙(T+환불창)·원천징수·어드민 지급센터·환불 회수(`voucher-clawback` 이 order_id 로 전 행을
 * 되돌린다)가 **전부 그대로 붙는다.** 새로 만든 지급 경로는 0 이다.
 *
 * ## 🔴 재원은 매장 몫이다 — 유어딜 수수료를 건드리지 않는다
 * `debit_account = seller:{id}`. 유어딜 5% 는 그대로고, 중개사 몫과 인플루언서 % 는 둘 다 매장의 95%
 * 안에서 나간다. 그래서 `check-commission-budget` 의 예산 아비터(플랫폼 부담 캡) 대상이 아니다 —
 * 같은 이유로 인플루언서 딜 적립(`helpers.ts`)이 그 표에서 "별개 source" 로 허용돼 있다.
 *
 * ## 요율 두 개 (결재 부속 확정)
 *   - `broker_share_pct`   — 중개사 몫. 매장 몫에서 나간다.
 *   - `influencer_pct_cap` — 인플루언서 예산 **상한**. 이 매장의 협업 코드·딜 % 가 이 값을 못 넘는다.
 *   둘 다 `seller_meta`(sellers 는 100컬럼 한도). 합이 90 을 넘지 못한다 — 매장에 남는 게 있어야 한다.
 *   케이스별 조정은 딜 행에서 한다(대표: *"매번 케이스마다 조정 가능하긴 해야해"*). 여기 값은 기본과 상한.
 *
 * ## OFF 일 때
 * 종전과 byte-동일 — 중개사는 매장과 장부 밖에서 직접 거래한다(2026-09-04 규칙). 켜는 것은 대표 판단이고
 * 선행은 `docs/STAGING_CHECKLIST.md` **S-BROKER** 실결제다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { swallow } from './swallow'
import { recordLedger, sellerLedgerAccount } from './ledger'
import { getSellerMeta, setSellerMeta } from './seller-meta'

export const BROKER_META = {
  userId: 'broker_user_id',
  sharePct: 'broker_share_pct',
  influencerCap: 'influencer_pct_cap',
} as const

export const BROKER_SHARE_PCT_MAX = 50
export const INFLUENCER_CAP_PCT_MAX = 50
/** 둘의 합 상한 — 매장에 최소 10% 는 남아야 한다(유어딜 5% 는 이 밖에서 이미 나갔다). */
export const BROKER_TERMS_SUM_MAX = 90

export interface BrokerTerms {
  brokerUserId: number | null
  sharePct: number
  influencerCapPct: number | null
}

/** 순수 검증 — 입력이 비면 0/null 로 본다. 테스트가 경계를 잰다. */
export function validateBrokerTerms(input: { broker_share_pct?: unknown; influencer_pct_cap?: unknown }):
  | { ok: true; sharePct: number; capPct: number | null }
  | { ok: false; error: string } {
  const share = input.broker_share_pct == null || input.broker_share_pct === '' ? 0 : Number(input.broker_share_pct)
  const cap = input.influencer_pct_cap == null || input.influencer_pct_cap === '' ? null : Number(input.influencer_pct_cap)
  if (!Number.isFinite(share) || share < 0 || share > BROKER_SHARE_PCT_MAX) {
    return { ok: false, error: `중개사 몫은 0 ~ ${BROKER_SHARE_PCT_MAX}% 사이여야 해요` }
  }
  if (cap !== null && (!Number.isFinite(cap) || cap < 0 || cap > INFLUENCER_CAP_PCT_MAX)) {
    return { ok: false, error: `인플루언서 커미션 상한은 0 ~ ${INFLUENCER_CAP_PCT_MAX}% 사이여야 해요` }
  }
  if (share + (cap ?? 0) > BROKER_TERMS_SUM_MAX) {
    return { ok: false, error: `중개사 몫과 인플루언서 상한의 합이 ${BROKER_TERMS_SUM_MAX}% 를 넘을 수 없어요` }
  }
  return { ok: true, sharePct: Math.round(share * 100) / 100, capPct: cap === null ? null : Math.round(cap * 100) / 100 }
}

export async function saveBrokerTerms(
  DB: D1Database,
  sellerId: number,
  terms: { brokerUserId?: number | null; sharePct: number; capPct: number | null },
): Promise<void> {
  await setSellerMeta(DB, sellerId, {
    ...(terms.brokerUserId !== undefined ? { [BROKER_META.userId]: terms.brokerUserId == null ? null : String(terms.brokerUserId) } : {}),
    [BROKER_META.sharePct]: String(terms.sharePct),
    [BROKER_META.influencerCap]: terms.capPct == null ? null : String(terms.capPct),
  })
}

export async function readBrokerTerms(DB: D1Database, sellerId: number): Promise<BrokerTerms> {
  const meta = (await getSellerMeta(DB, [sellerId])).get(sellerId) || {}
  const uid = Number(meta[BROKER_META.userId])
  const share = Number(meta[BROKER_META.sharePct])
  const cap = Number(meta[BROKER_META.influencerCap])
  return {
    brokerUserId: Number.isFinite(uid) && uid > 0 ? uid : null,
    sharePct: Number.isFinite(share) && share > 0 ? share : 0,
    influencerCapPct: Number.isFinite(cap) && cap > 0 ? cap : null,
  }
}

export async function isBrokerShareEnabled(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'broker_share_enabled' LIMIT 1")
    .first<{ value: string }>().catch(() => null)
  return String(row?.value) === 'true'
}

const _ensured = new WeakSet<object>()
async function ensureBrokerIdempotency(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  // 주문당 1행 — 결제 확정 경로가 둘(딜 /join · 카드 confirm-toss)이라 UNIQUE 로 잠근다(머니 룰 #3).
  await DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_infl_attr_broker_order
       ON influencer_attributions(order_id) WHERE source = 'broker_share' AND order_id > 0`,
  ).run().catch(swallow('broker-share:idx'))
}

/** 순수 — 적립액. 테스트가 잰다. */
export function calcBrokerShareAmount(totalAmount: number, sharePct: number): number {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(sharePct) || sharePct <= 0) return 0
  return Math.floor(totalAmount * sharePct / 100)
}

export interface CreditBrokerShareInput {
  sellerId: number
  orderId: number
  orderNumber: string
  productId: number
  totalAmount: number
  refundWindowDays: number
}

/**
 * 결제 확정 시 호출. 게이트 OFF·중개사 없음·요율 0·중복이면 `{ credited: 0 }` 로 조용히 끝난다.
 * fail-soft — 결제를 막지 않는다(적립 실패는 로그).
 */
export async function creditBrokerShare(DB: D1Database, p: CreditBrokerShareInput): Promise<{ credited: number; brokerUserId: number | null }> {
  try {
    if (!(await isBrokerShareEnabled(DB))) return { credited: 0, brokerUserId: null }
    if (!Number.isFinite(p.orderId) || p.orderId <= 0) return { credited: 0, brokerUserId: null }
    const terms = await readBrokerTerms(DB, p.sellerId)
    if (!terms.brokerUserId || terms.sharePct <= 0) return { credited: 0, brokerUserId: null }
    const amount = calcBrokerShareAmount(p.totalAmount, terms.sharePct)
    if (amount <= 0) return { credited: 0, brokerUserId: terms.brokerUserId }
    const brokerId = String(terms.brokerUserId)

    await ensureBrokerIdempotency(DB)
    const availableAt = new Date(Date.now() + Math.max(0, p.refundWindowDays) * 86400_000).toISOString()
    const ins = await DB.prepare(
      `INSERT OR IGNORE INTO influencer_attributions
         (influencer_id, order_id, product_id, seller_id, commission_amount, status, available_at, source)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, 'broker_share')`,
    ).bind(brokerId, p.orderId, p.productId, p.sellerId, amount, availableAt).run()
    if (!ins.meta?.changes) return { credited: 0, brokerUserId: terms.brokerUserId } // 이미 적립됨(멱등)

    await DB.prepare(
      `INSERT INTO influencer_balances (influencer_id, pending_amount, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(influencer_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')`,
    ).bind(brokerId, amount).run()
    await recordLedger(DB, {
      event_type: 'broker_share',
      reference_id: p.orderNumber,
      amount,
      debit_account: sellerLedgerAccount(p.sellerId),
      credit_account: `influencer:${brokerId}`,
      metadata: { product_id: p.productId, order_id: p.orderId, share_pct: terms.sharePct, available_at: availableAt },
    })
    return { credited: amount, brokerUserId: terms.brokerUserId }
  } catch (e) {
    console.error('[broker-share] credit failed', e)
    return { credited: 0, brokerUserId: null }
  }
}
