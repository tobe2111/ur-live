/**
 * 🛡️ 2026-05-15 (TD-G01 3단계): group-buy 공유 helpers — sub-router 들이 import.
 *
 * 분리 이유: voucher / public / seller / admin sub-router 가 같은 helper 사용 →
 *           main 파일에 헬퍼 두면 순환 import. 별도 파일로 분리.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { sendTextNotice } from '../../../lib/text-notice' // 📨 알림은 카톡 알림톡 하나로(SENS — 승인 전 템플릿은 보내지 않는다)
import { existingColumns, columnNameOf } from '../../../worker/utils/ensure-columns'
import { recordLedger } from '../../../worker/utils/ledger'
import { isOwnAgencyReferral } from '../../../worker/utils/agency-share-payout' // 🤝 규칙 1 — 에이전시 자기 링크엔 소개비 없음
import { dbKey } from '../../../worker/utils/d1-read-replica' // 세션(사본)이어도 메모는 원본 기준
import { calcInfluencerCommissionPct, type CommissionRates } from './commission-rates'
// 💸 매장 수수료율(채널 > override > tier > default)은 `seller-commission-rate.ts` 로 분리했다
//   (2026-08-27 — 채널 요율이 들어오며 설명이 필요한 개념이 됐다). 호출부 호환을 위해 재수출한다.
export { getMealVoucherCommissionRate, getSellerCommissionRate } from './seller-commission-rate'

/**
 * 테이블 + 컬럼 자동 생성 (마이그레이션 미적용 시 fallback).
 * products 에 group-buy 관련 컬럼 추가 + vouchers 테이블 생성.
 */
/**
 * 🛡️ 2026-05-19: per-worker 메모이제이션 — 매 요청마다 15+ ALTER TABLE 실행하던 패턴 제거.
 *   효과: group-buy 모든 페이지 응답시간 0.5-1초 단축.
 *
 * 🐌 2026-09-17 (대표 *"내 이용권이 너무 늦게 떠. 로딩이 느려"*) — 그 메모이제이션은 **isolate 안에서만**
 *   통한다. Cloudflare 는 isolate 를 자주 새로 띄우므로 저트래픽 대시보드에서는 사실상 매번 콜드고,
 *   그때마다 아래 ALTER 20개가 **직렬로** 돈다. 그리고 라이브 실측(2026-09-17, `PRAGMA table_info`):
 *   **20개 전부가 이미 존재해 100% 실패한다.** 셀러 홈의 이용권 목록은 그 20 왕복을 다 기다린 뒤에야
 *   자기 쿼리를 시작했다 — 에러가 없어 아무도 못 봤다.
 *
 *   ⇒ 같은 레포가 이미 쓰는 처방을 가져온다(`supply/api/supply-visibility.ts`): **컬럼 목록을 한 번 읽고
 *   없는 것만 ALTER.** 라이브에서는 ALTER 0회 · 왕복 20 → 2(PRAGMA 두 번).
 *   동작은 종전과 같다 — 없으면 추가하고 있으면 건너뛴다(종전엔 '추가 시도 후 실패로 건너뜀'이었다).
 *
 *   ⚠️ PRAGMA 가 실패하거나 테이블이 없으면 **빈 집합**으로 떨어져 전부 시도한다 = 종전 동작 그대로.
 *   새 D1(컬럼이 진짜 없는 환경)에서 self-heal 이 약해지지 않는다.
 */
let _ensuredTables = false
export async function ensureTables(DB: D1Database): Promise<void> {
  if (_done_ensureTables.has(dbKey(DB))) return
  _done_ensureTables.add(dbKey(DB))
  if (_ensuredTables) return
  const columns = [
    'restaurant_name TEXT', 'restaurant_address TEXT', 'restaurant_phone TEXT',
    'restaurant_lat REAL', 'restaurant_lng REAL',
    'voucher_expiry DATE', 'voucher_terms TEXT',
    'group_buy_target INTEGER DEFAULT 0', 'group_buy_current INTEGER DEFAULT 0',
    'group_buy_deadline DATETIME', "group_buy_status TEXT DEFAULT 'active'",
    'store_verify_pin TEXT',
    // 🛡️ 2026-04-27: Magic Link — 사장님 PIN 없이 통계 페이지 진입.
    'store_owner_token TEXT',
    // 🛡️ 2026-05-15: 티어 할인 시스템 — JSON 배열 [{ "min": 5, "discount_pct": 10 }, ...]
    'group_buy_tiers TEXT',
    // 🛡️ 2026-05-15: 마일스톤 알림 dedup
    'milestone_notified_50 INTEGER DEFAULT 0',
    'milestone_notified_80 INTEGER DEFAULT 0',
    'milestone_notified_lastone INTEGER DEFAULT 0',
  ]
  const haveProducts = await existingColumns(DB, 'products')
  for (const col of columns) {
    if (haveProducts.has(columnNameOf(col))) continue
    try { await DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_store_owner_token ON products(store_owner_token)`).run()
  } catch { /* exists */ }
  // 🛡️ 2026-05-22 perf index 즉시 적용 — schema-repair cron (18 UTC) 기다리지 않고
  //   ensureTables 첫 호출 시 자동 생성. 멱등 (IF NOT EXISTS).
  //   migrations/0276 와 동일한 partial composite index.
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_groupbuy_feed ON products (category, group_buy_status, created_at DESC) WHERE is_active = 1`).run()
  } catch { /* exists */ }
  // 🛡️ 2026-05-22 사용자 신고 "공동구매만 늦음" 영구 해결:
  //   LEFT JOIN gift_catalog ON gc.gift_code = p.kt_alpha_gift_code 의 인덱스 부재 →
  //   매 요청마다 full table scan (100ms+). 인덱스 추가로 즉시 lookup.
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_kt_alpha_gift_code ON products(kt_alpha_gift_code) WHERE kt_alpha_gift_code IS NOT NULL`).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_gift_catalog_gift_code ON gift_catalog(gift_code)`).run()
  } catch { /* table missing — OK */ }
  // 🛡️ 2026-05-22: materialized cache table 도 동시 생성 (cron 이 사용).
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS group_buy_feed_cache (
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      product_json TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      computed_at DATETIME NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (status, category)
    )`).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'unused',
        used_at DATETIME,
        expires_at DATETIME,
        applied_discount_pct INTEGER DEFAULT 0,
        applied_price INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
  // applied_* 컬럼 자동 추가 (기존 테이블 마이그레이션)
  // 🎁 2026-07-12 is_experience: 0원 체험권 마킹(정산 제외용, 체험 캠페인 트랙 WP-A).
  const haveVouchers = await existingColumns(DB, 'vouchers')
  for (const col of ['applied_discount_pct INTEGER DEFAULT 0', 'applied_price INTEGER', 'is_experience INTEGER DEFAULT 0']) {
    if (haveVouchers.has(columnNameOf(col))) continue
    try { await DB.prepare(`ALTER TABLE vouchers ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  _ensuredTables = true
}

/**
 * 티어 할인 계산 — group_buy_tiers JSON 파싱 + current 에 맞는 최고 tier 적용.
 *   tiers = [{ min: 5, discount_pct: 5 }, { min: 10, discount_pct: 15 }, { min: 20, discount_pct: 25 }]
 *   current=12 → discount_pct=15 (가장 높은 충족 tier)
 *   tiers null/empty → discount_pct=0
 */
export function calcTierDiscount(
  tiersJson: string | null,
  current: number,
): { discount_pct: number; next_tier: { min: number; discount_pct: number } | null } {
  if (!tiersJson) return { discount_pct: 0, next_tier: null }
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return { discount_pct: 0, next_tier: null }
    // 정렬 후 current 이하 max + current 초과 min 찾기
    const sorted = [...tiers].sort((a, b) => a.min - b.min)
    let achieved = 0
    let next: { min: number; discount_pct: number } | null = null
    for (const t of sorted) {
      if (current >= t.min) achieved = Math.max(achieved, t.discount_pct)
      else { next = t; break }
    }
    return { discount_pct: achieved, next_tier: next }
  } catch { return { discount_pct: 0, next_tier: null } }
}

/**
 * 🛡️ 2026-05-30: 즉시판매 단일가 모델 (공동구매 = 즉시판매, design/groupbuy-instant-sale.md).
 *   인원수와 무관하게 **최대 tier 할인**을 처음부터 모두에게 적용 (A2 — 그룹가 즉시 단일 적용).
 *   calcTierDiscount(인원 기반 동적 인하) 를 대체 — "먼저 산 사람이 더 비쌈" 모순 제거.
 *   tiers null/empty → 0 (셀러가 price 를 단일 공구가로 직접 설정한 신규 모델).
 */
export function maxTierDiscount(tiersJson: string | null): number {
  if (!tiersJson) return 0
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return 0
    return tiers.reduce((max, t) => Math.max(max, Number(t.discount_pct) || 0), 0)
  } catch { return 0 }
}

// 💸 clawbackVoucherCommission 은 ./voucher-clawback.ts 로 추출(2026-08-25 file-size 래칫) — 호출부 호환 위해 재수출.
export { clawbackVoucherCommission } from './voucher-clawback'


/**
 * 🛡️ 2026-05-31: 공구 인플루언서 referral attribution + 사용자 추천 보너스 (딜/카드 공통).
 *   딜 경로(group-buy.routes.ts /join)의 인라인 4-account split 로직과 동일 — confirm-toss(카드)
 *   가 동일 로직을 호출하도록 추출 (이전: 카드 결제 referral 인플 커미션 미적립 갭).
 *   호출 전 referralInfluencerId 는 형식/자기참조/존재 검증 완료된 값이어야 함.
 *   반환 amount 로 호출자가 sellerAmount(정산 row) 계산.
 */
export async function applyGroupBuyReferral(
  DB: D1Database,
  rates: CommissionRates,
  p: {
    referralInfluencerId: string
    sellerId: number
    productId: number
    productName: string
    totalAmount: number
    orderNumber: string
    /** 숫자 order id — attribution 연결용(clawback 이 order_id 로 매칭). 0/누락 시 clawback 불가. */
    orderId?: number
    userId: string
    productReferralDisabled?: boolean
  },
): Promise<{ influencerAmount: number; userBonusAmount: number; influencerActive: boolean }> {
  if (!p.referralInfluencerId) return { influencerAmount: 0, userBonusAmount: 0, influencerActive: false }

  // 매장 marketing_enabled / 차단 / 상품 referral_disabled → 인플 비활성 (사용자 보너스는 유지).
  const blocked = await DB.prepare(
    "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL"
  ).bind(p.sellerId, p.referralInfluencerId).first().catch(() => null)
  const sellerRow = await DB.prepare(
    `SELECT COALESCE(marketing_enabled, 1) AS marketing_enabled, referred_by_influencer, referral_bonus_until FROM sellers WHERE id = ?`
  ).bind(p.sellerId).first<{ marketing_enabled: number; referred_by_influencer: string | null; referral_bonus_until: string | null }>().catch(() => null)
  const influencerActive = !blocked && Number(sellerRow?.marketing_enabled ?? 1) === 1 && !p.productReferralDisabled
    && !(await isOwnAgencyReferral(DB, p.referralInfluencerId, p.sellerId, p.productId)) // 🤝 규칙 1: 에이전시 자기 링크 = 소개비 없음

  let effectiveInfluencerPct = 0
  if (influencerActive) {
    const isReferredByThis = sellerRow?.referred_by_influencer === p.referralInfluencerId
    const referralBonusActive = !!sellerRow?.referral_bonus_until && new Date(sellerRow.referral_bonus_until) > new Date()
    const dealRow = await DB.prepare(
      `SELECT commission_pct FROM seller_influencer_deals WHERE seller_id = ? AND influencer_id = ? AND status = 'active' AND (ends_at IS NULL OR ends_at > datetime('now')) AND (COALESCE(requires_content_proof, 0) = 0 OR proof_status = 'approved') LIMIT 1`
    ).bind(p.sellerId, p.referralInfluencerId).first<{ commission_pct: number }>().catch(() => null)
    effectiveInfluencerPct = calcInfluencerCommissionPct(rates, {
      is_referred_by_this_influencer: isReferredByThis,
      referral_bonus_active: referralBonusActive,
      deal_commission_pct: dealRow?.commission_pct ?? null,
    })
  }
  const influencerAmount = influencerActive ? Math.floor(p.totalAmount * effectiveInfluencerPct / 100) : 0
  const userBonusAmount = Math.floor(p.totalAmount * rates.user_referral_bonus_pct / 100)

  // 사용자 추천 보너스 (active 든 차단이든 약속한 보너스는 지급).
  if (userBonusAmount > 0) {
    try {
      await DB.prepare("UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(userBonusAmount, p.userId).run()
      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
         VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
      ).bind(p.userId, userBonusAmount, userBonusAmount, p.userId, `친구 추천 보너스 (${p.productName})`, p.orderNumber).run()
      await recordLedger(DB, {
        event_type: 'user_referral_bonus', reference_id: p.orderNumber, amount: userBonusAmount,
        debit_account: influencerActive ? `seller:${p.sellerId}` : 'platform:commission',
        credit_account: `user:${p.userId}`,
        metadata: { source: 'influencer_referral', influencer_id: p.referralInfluencerId, absorbed_by_platform: !influencerActive },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[gb referral user-bonus]', e) }
  }
  // 인플루언서 attribution + balance pending (활성 시만).
  if (influencerActive && influencerAmount > 0) {
    try {
      const availableAt = new Date(Date.now() + rates.refund_window_days * 86400_000).toISOString()
      await DB.prepare(
        `INSERT INTO influencer_attributions (influencer_id, order_id, product_id, seller_id, commission_amount, status, available_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(p.referralInfluencerId, p.orderId ?? 0, p.productId, p.sellerId, influencerAmount, availableAt).run()
      await DB.prepare(
        `INSERT INTO influencer_balances (influencer_id, pending_amount, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(influencer_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')`
      ).bind(p.referralInfluencerId, influencerAmount).run()
      await recordLedger(DB, {
        event_type: 'influencer_commission', reference_id: p.orderNumber, amount: influencerAmount,
        debit_account: `seller:${p.sellerId}`, credit_account: `influencer:${p.referralInfluencerId}`,
        metadata: { product_id: p.productId, available_at: availableAt },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[gb referral attribution]', e) }
  }
  return { influencerAmount, userBonusAmount, influencerActive }
}

/**
 * 🛡️ 2026-05-30: 환불 완료 알림톡 통합 — 셀러/어드민 환불, 사용자 셀프취소, 부분환불 공통.
 *   users.phone 조회 후 sendSystemAlimtalk('voucher_refunded'). best-effort (phone 없으면 skip).
 */
export async function sendRefundAlimtalk(
  env: Record<string, unknown>,
  DB: D1Database,
  userId: string | null,
  productName: string,
  amount: number,
): Promise<void> {
  try {
    if (!userId) return
    const user = await DB.prepare('SELECT phone FROM users WHERE id = ?').bind(userId).first<{ phone: string }>()
    if (!user?.phone) return
    const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
    const msg = `[유어딜] 환불 완료 — ${productName}\n${amount.toLocaleString('ko-KR')}원이 환불 처리되었습니다.\n(딜 결제건은 즉시 잔액 반영, 카드 결제건은 영업일 기준 3~5일 소요)`
    await sendSystemAlimtalk(env, user.phone, 'voucher_refunded', msg)
  } catch { /* best-effort */ }
}

/**
 * 🔢 이용권 코드 — **6자리 숫자** (2026-10-12 대표 *"6자리로 줄이고 숫자로만."*).
 *
 * 종전 `UR-XXXX-XXXX`(영문+숫자 8자, 1조 가지)는 손님·직원이 읽고 부르기 어려웠다. 숫자 6자리는
 * 100만 가지라 **두 가지가 같이 바뀐다**:
 *   ① 대입 — 코드는 열쇠다(사용 처리가 로그인 없이 [코드 + 매장 확인코드]만 받는다). 틀린 시도를
 *      세서 막는다 → `worker/utils/voucher-code-guard.ts`
 *   ② 겹침 — 1조 가지에선 겹칠 일이 없어서 "겹치면 저장이 실패하고 호출하는 쪽이 다시 시도한다" 고
 *      적어 두고 **다시 시도하는 코드는 없었다**. 100만 가지에선 실제로 겹칠 수 있고, 카드 결제 확정
 *      경로에서 겹치면 **돈은 받았는데 이용권 저장이 실패**한다. 그래서 발급 전에 DB 에 있는지 본다
 *      (`generateUniqueVoucherCodes`).
 *
 * 앞자리 0 도 쓴다(`004512`) — 문자열이라 숫자로 바꾸지 말 것(앞 0 이 사라진다).
 * 기존 `UR-` 코드는 그대로 유효하다(조회·사용은 문자열 일치).
 */
export const VOUCHER_CODE_DIGITS = 6
const CODE_SPACE = 10 ** VOUCHER_CODE_DIGITS
/** 2^32 를 100만으로 나눈 나머지 쪽 치우침을 버린다(앞 번호가 더 자주 나오지 않게). */
const UNBIASED_LIMIT = Math.floor(0x1_0000_0000 / CODE_SPACE) * CODE_SPACE

export function generateVoucherCode(): string {
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < UNBIASED_LIMIT) return String(buf[0] % CODE_SPACE).padStart(VOUCHER_CODE_DIGITS, '0')
  }
}

/**
 * 겹치지 않는 코드 n 개 — 한 번의 조회로 DB 에 이미 있는 번호를 거르고, 걸린 것만 다시 뽑는다.
 * 같은 묶음 안에서도 겹치지 않는다. 8번 안에 못 채우면 예외(그때는 번호가 바닥나고 있다는 뜻이다).
 * ⚠️ 두 결제가 같은 순간 같은 번호를 뽑는 경우는 못 막는다(UNIQUE 가 막고 저장이 실패한다) —
 *   100만 칸에서 동시에 같은 번호가 나올 확률이라 무시할 수준이다.
 */
export async function generateUniqueVoucherCodes(DB: D1Database, n: number): Promise<string[]> {
  const out = new Set<string>()
  for (let round = 0; round < 8 && out.size < n; round++) {
    const want = n - out.size
    const fresh = new Set<string>()
    while (fresh.size < want) {
      const c = generateVoucherCode()
      if (!out.has(c)) fresh.add(c)
    }
    const list = [...fresh]
    const taken = new Set<string>()
    try {
      const rows = await DB.prepare(`SELECT code FROM vouchers WHERE code IN (${list.map(() => '?').join(',')})`)
        .bind(...list).all<{ code: string }>()
      for (const r of rows.results || []) taken.add(String(r.code))
    } catch { /* 조회 실패 — UNIQUE 가 최후의 문이다 */ }
    for (const c of list) if (!taken.has(c)) out.add(c)
  }
  if (out.size < n) throw new Error('voucher code space exhausted')
  return [...out]
}

export async function generateUniqueVoucherCode(DB: D1Database): Promise<string> {
  return (await generateUniqueVoucherCodes(DB, 1))[0]
}

/** Magic Link 사장님 토큰 — 32자 hex (128bit), URL-safe. */
export function generateStoreOwnerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 사장님께 Magic Link 알림톡 발송 (best-effort).
 * 알림톡(`sendTextNotice` → SENS) — 키 미설정 시 silent skip.
 */
export async function sendStoreOwnerAlimtalk(
  env: unknown,
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string; categoryLabel?: string }
): Promise<void> {
  if (!phone) return
  try {
    // 정규화: 010-xxxx-xxxx → 01012345678
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return

    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션 (default '이용권').
    const label = data.categoryLabel || '이용권'
    const message = `[유어딜] ${label} 통계 페이지 안내

안녕하세요, ${data.restaurantName || '매장'} 사장님!
"${data.productName}" ${label}이 등록되었습니다.

📊 실시간 발급/사용 현황 확인:
${data.statsUrl}

✅ 이 링크는 사장님 전용 영구 링크입니다.
즐겨찾기에 추가하시면 편하게 확인할 수 있어요.

문의가 있으시면 언제든 연락주세요.`

    await sendTextNotice(env, cleanPhone, { tpl: 'store_owner_stats_link', title: '이용권 현황 안내', text: message })
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 사용자에게 voucher 발급 알림톡 (결제 완료 직후).
 *   링크: https://urdeal.kr/my-vouchers (QR 코드 화면 진입)
 */
export async function sendBuyerVoucherIssuedAlimtalk(
  env: unknown,
  phone: string,
  data: { productName: string; restaurantName?: string; qty: number; expiresAt: string | null; categoryLabel?: string }
): Promise<void> {
  if (!phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const expDate = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) + '까지' : '제한 없음' // 미설정 = 무기한(2026-08-22 대표)
    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션.
    const label = data.categoryLabel || '이용권'
    const message = `[유어딜] ${label} 발급 완료

${data.restaurantName || '유어딜'} · ${data.productName}
${data.qty}장 발급되었습니다.

📱 매장에서 아래 [내 이용권 보기]를 눌러 QR 코드를 보여주세요.

⏰ 유효기간: ${expDate}

문의: 유어딜 고객센터`
    await sendTextNotice(env, cleanPhone, { tpl: 'voucher_issued', title: '이용권 발급 완료', text: message })
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 매장 사장님에게 "곧 손님 옵니다" 친절 알림톡 (첫 voucher 발급 시 1회).
 *   sellers.first_voucher_notified flag 로 dedup.
 */
export async function sendSellerFirstVoucherAlimtalk(
  env: unknown,
  phone: string,
  data: { restaurantName: string; productName: string; sellerId: unknown } // 🔘 버튼(사용 처리·정산 계좌)의 매장 번호
): Promise<void> {
  if (!phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    // 🩸 2026-10-10: 옛 문구("식권"·없는 매장 전용 링크·"7일 후 자동 송금")를 사실로 교체 — 정산은 계좌 등록 + 정산 주기.
    const message = `[유어딜] 🎉 첫 이용권이 팔렸어요

${data.restaurantName} 사장님,
"${data.productName}" 이용권을 손님이 구매했어요.

📋 손님이 오시면
1. 아래 [사용 처리하기]를 눌러 손님 폰의 이용권 QR 을 스캔하거나
2. 손님이 매장 확인코드를 직접 입력해 사용 처리합니다
3. 이미 유어딜에서 결제가 끝났으니 따로 결제 받지 마세요

💰 정산
사용 처리된 금액이 정산 계좌로 지급됩니다. 계좌를 아직 안 올리셨다면 아래 [정산 계좌 등록]에서 등록해 주세요.

문의: 유어딜 고객센터`
    await sendTextNotice(env, cleanPhone, { tpl: 'seller_first_voucher', title: '첫 이용권 판매', text: message, sellerId: data.sellerId })
  } catch { /* graceful */ }
}

/**
 * 📣 2026-07-05 (운영 감사 Q4 — "판매될 때마다 사장님이 알아야"): 건별 판매 알림톡.
 *   첫 판매는 sendSellerFirstVoucherAlimtalk(온보딩 상세)가 담당 — 이 함수는 2번째 판매부터.
 *   호출측(group-buy.routes)이 first_voucher_notified 로 분기해 첫 판매 이중발송 없음.
 */
export async function sendSellerVoucherSoldAlimtalk(
  env: unknown,
  phone: string,
  data: { restaurantName: string; productName: string; qty: number; amount: number; sellerId: unknown } // 🔘 버튼(사용 처리·판매 내역)의 매장 번호
): Promise<void> {
  if (!phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    // 🩸 2026-10-31 카카오 반려("수신자 액션 문구 · 변수 앞 고정 타이틀") 반영 — 등록 문서와 글자까지 같다.
    const message = `[유어딜] 이용권 판매 안내

사장님 매장의 이용권을 손님이 구매했습니다.

· 매장명: ${data.restaurantName}
· 상품명: ${data.productName}
· 수량: ${data.qty}장
· 결제 금액: ${Number(data.amount).toLocaleString('ko-KR')}원

손님이 오시면 아래 [사용 처리하기]를 눌러 주세요.

문의: 유어딜 고객센터`
    await sendTextNotice(env, cleanPhone, { tpl: 'seller_voucher_sold', title: '이용권 판매', text: message, sellerId: data.sellerId })
  } catch { /* graceful */ }
}

/**
 * 📣 2026-07-05 (운영 감사 Q4): 손님이 **셀프(PIN/매장코드)** 로 사용 처리했을 때 사장님 알림톡.
 *   사장님이 직접 스캔(use-by-seller)한 경우는 본인이 실행자라 발송하지 않음(호출측 책임).
 */
export async function sendSellerVoucherUsedAlimtalk(
  env: unknown,
  phone: string,
  data: { restaurantName: string; productName: string; usedAt?: string; ordersUrl?: string }
): Promise<void> {
  if (!phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : ''
    const message = `[유어딜] ✅ 이용권 사용 처리됨

${data.restaurantName}
"${data.productName}"
사용 시각: ${ts || '-'}

손님이 매장에서 셀프 사용 처리했어요.
정산은 정산 주기에 맞춰 등록한 계좌로 지급됩니다.

사용 내역: ${data.ordersUrl || 'https://urdeal.kr/seller/voucher-orders'}

문의: 유어딜 고객센터`
    await sendTextNotice(env, cleanPhone, { tpl: 'seller_voucher_used', title: '이용권 사용 처리', text: message })
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: voucher 사용 완료 알림톡 (매장이 QR 스캔 직후).
 * 📨 2026-10-11: 알림톡 하나로(`sendTextNotice`, 2026-10-12 부터 SENS) — 'voucher_used' 가 카카오 검수를 통과해 어드민 승인 목록에
 *   오르면 알림톡, 그 전엔 문자. ⚠️ 알림톡 전환 시 message 를 승인 템플릿 본문과 일치시켜 유지.
 */
export async function sendBuyerVoucherUsedAlimtalk(
  env: unknown,
  phone: string,
  data: { restaurantName: string; productName: string; usedAt?: string; categoryLabel?: string }
): Promise<void> {
  if (!phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : ''
    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션.
    const label = data.categoryLabel || '이용권'
    const message = `[유어딜] ✅ ${label} 사용 완료

${data.restaurantName}
"${data.productName}"
사용 시각: ${ts || '-'}

이용해 주셔서 감사합니다.

후기 남기기:
https://urdeal.kr/my-vouchers

문의: 유어딜 고객센터`
    await sendTextNotice(env, cleanPhone, { tpl: 'voucher_used', title: '이용권 사용 완료', text: message })
  } catch { /* graceful */ }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()

/**
 * 🔐 2026-06-11 (머니 감사 High#3): 환불 시 구매자 본인 referral_bonus 포인트 회수.
 *   creditReferralRewards 가 user_points 에 즉시 적립(point_transactions type='referral_bonus',
 *   order_id=orderNumber)하는데 회수 코드가 전무 → 추천링크 구매→셀프취소 반복 파밍 가능.
 *   멱등: point_transactions 역전 마커(type='referral_bonus_reversed') 존재 시 skip.
 */
export async function reverseReferralBonusOnRefund(
  DB: D1Database,
  orderNumber: string,
): Promise<number> {
  if (!orderNumber) return 0
  try {
    // 💸 2026-07-05 버킷: 아래 회수 UPDATE 가 free_balance 컬럼 참조 — 사전 보장(멱등).
    const { ensureDealBuckets } = await import('../../../worker/utils/point-buckets')
    await ensureDealBuckets(DB)
    const rows = await DB.prepare(
      "SELECT user_id, points_amount FROM point_transactions WHERE order_id = ? AND type = 'referral_bonus'"
    ).bind(orderNumber).all<{ user_id: string; points_amount: number }>().catch(() => ({ results: [] as { user_id: string; points_amount: number }[] }))
    let reversed = 0
    for (const t of rows.results || []) {
      const dup = await DB.prepare(
        "SELECT 1 AS x FROM point_transactions WHERE order_id = ? AND type = 'referral_bonus_reversed' AND user_id = ? LIMIT 1"
      ).bind(orderNumber, t.user_id).first<{ x: number }>().catch(() => null)
      if (dup) continue
      const amt = Math.floor(t.points_amount || 0)
      if (amt <= 0) continue
      // 💸 2026-07-05 버킷: referral_bonus 는 무상 적립 → 회수도 free 에서 (무상 적립-역전 대칭).
      await DB.prepare("UPDATE user_points SET balance = MAX(0, balance - ?), free_balance = MAX(0, COALESCE(free_balance, 0) - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(amt, amt, t.user_id).run().catch(() => {})
      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id, free_delta)
         VALUES (?, 'referral_bonus_reversed', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?, ?)`
      ).bind(t.user_id, -amt, -amt, t.user_id, '추천 보너스 환불 회수', orderNumber, -amt).run().catch(async () => { const m = await import('../../../worker/utils/point-ledger'); await m.recordPointTxMinimal(DB, t.user_id, 'referral_bonus_reversed', -amt, '추천 보너스 환불 회수') })
      reversed++
    }
    return reversed
  } catch { return 0 }
}
