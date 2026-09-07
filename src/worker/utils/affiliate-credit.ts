/**
 * 🏁 2026-06-12 (전 플로우 감사 🔴): 큐레이터/추천 적립 코어 — affiliate.routes.ts /track 에서 추출.
 *
 * 배경: 물리상품(쇼핑 체크아웃) 경로는 order.routes 가 내부 fetch('/api/affiliate/track') 를
 * 쏘는데 ① 인증 헤더가 없어 항상 401 ② 호출 시점 주문이 PENDING 이라 상태검사에도 차단 —
 * 이중 사망으로 **적립이 0** 이었음. 해결: 주문 생성 시 의도를 order_referrer_intents 에 저장,
 * 결제 확정(/confirm)에서 이 헬퍼를 직접 호출(서버 신뢰 문맥 — 구매자=주문 소유자 자명).
 *
 * 검증 로직은 /track 과 1:1 동일(자기추천/셀프구매 fraud 기록, 멱등, IP 어뷰즈, 상품별
 * referral_enabled/rate, user_points 적립, 알림+푸시). /track 라우트도 이 헬퍼를 호출하도록
 * 리팩토링 — 단일 SSOT.
 */
import { adjustUserPoints } from './point-ledger'
import { DEFAULT_AFFILIATE_RATE } from '../../shared/affiliate-rate'

// 🛡️ 2026-06-17 (대표 결정 — 1인 치킨게임): 추천 적립 기본 fallback 5% → 2%.
//   추천은 CAC(획득비)라 끄지 않고 낮춤. 어드민 platform_settings.affiliate_commission_rate 로 추가 조정/0 가능
//   (AdminPlatformSettingsPage 기본 표기 '2' 와 일치). 상품별 referral_enabled=0 으로 개별 OFF.
// 📌 2026-09-05: 값은 `shared/affiliate-rate.ts` 로 이전(화면과 같은 숫자를 쓰게).
//   여기 로직은 byte-불변 — 상수만 import 한다.
const DEFAULT_COMMISSION_RATE = DEFAULT_AFFILIATE_RATE

/** /track 의 resolveCommissionRate 와 1:1 동일 (SSOT 이동 — routes 가 이걸 import). */
export async function resolveCommissionRate(
  DB: D1Database,
  productId: number | null | undefined,
): Promise<number | null> {
  if (productId) {
    try {
      const row = await DB.prepare(
        'SELECT referral_enabled, referral_commission_rate FROM products WHERE id = ?'
      ).bind(productId).first<{ referral_enabled: number | null; referral_commission_rate: number | null }>()
      if (!row) return null
      if (Number(row.referral_enabled) !== 1) return null
      if (row.referral_commission_rate != null && Number.isFinite(row.referral_commission_rate)) {
        return Math.max(0, Math.min(1, Number(row.referral_commission_rate)))
      }
    } catch { /* 컬럼 미존재 → platform default fallback */ }
  }
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_commission_rate'").first<{ value: string }>()
    if (row?.value) return parseFloat(row.value) / 100
  } catch { /* */ }
  return DEFAULT_COMMISSION_RATE
}

export interface AffiliateCreditInput {
  referrerId: string
  orderId: number
  productId?: number | null
  productName?: string | null
  buyerIp?: string | null
}

export type AffiliateCreditResult =
  | { ok: true; commission: number }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PAID' | 'SELF_REFERRAL' | 'SELF_PURCHASE' | 'SELF_SELLER' | 'DUPLICATE' | 'IP_ABUSE' | 'REFERRER_CAP' | 'REFERRAL_DISABLED' | 'BUDGET_EXHAUSTED' | 'PROGRAM_DISABLED' | 'ERROR' }

interface CommissionBreakdown {
  commission: number
  primaryProductId: number | null
  primaryProductName: string | null
  eligibleLines: number
}

/**
 * 🧾 주문 라인별 추천 커미션 계산 (멀티상품 정확 귀속).
 *   order_items 의 referral_enabled 라인만 각 상품 비율로 적립액 합산 (배송비/비대상 상품 제외).
 *   기존엔 첫 상품 비율 × 주문총액(배송비 포함) 이라 멀티상품 주문에서 과/미적립.
 *   order_items 부재(레거시/직접결제) 시 fallbackProductId 비율 × 주문총액으로 fallback.
 *   반환 null = 적립 대상 라인 0 (REFERRAL_DISABLED).
 *   💸 2026-07-04 [INV-CB]: 예산 아비터(order-commissions.ts)의 요청액 산출용으로 export.
 */
export async function computeOrderCommission(
  DB: D1Database,
  orderId: number,
  orderAmount: number,
  fallbackProductId: number | null | undefined,
  fallbackProductName: string | null | undefined,
): Promise<CommissionBreakdown | null> {
  let lines: { product_id: number | null; product_name: string | null; line_amount: number }[] = []
  try {
    const r = await DB.prepare(
      `SELECT product_id, product_name,
              COALESCE(subtotal, price * quantity, price, 0) AS line_amount
       FROM order_items WHERE order_id = ?`,
    ).bind(orderId).all<{ product_id: number | null; product_name: string | null; line_amount: number }>()
    lines = r.results ?? []
  } catch { /* order_items 없음 — fallback */ }

  if (lines.length > 0) {
    let commission = 0
    let eligibleLines = 0
    let primaryProductId: number | null = null
    let primaryProductName: string | null = null
    for (const ln of lines) {
      const pid = ln.product_id != null ? Number(ln.product_id) : null
      const rate = await resolveCommissionRate(DB, pid)
      if (rate == null) continue          // 이 상품은 추천 비대상 — skip
      const amt = Number(ln.line_amount) || 0
      if (amt <= 0) continue
      commission += Math.round(amt * rate)
      eligibleLines++
      if (primaryProductId == null) {
        primaryProductId = pid
        primaryProductName = ln.product_name ?? null
      }
    }
    if (eligibleLines === 0 || commission <= 0) return null
    return { commission, primaryProductId, primaryProductName, eligibleLines }
  }

  // Fallback — order_items 없음: 기존 단일 상품 비율 × 주문총액
  const rate = await resolveCommissionRate(DB, fallbackProductId != null ? Number(fallbackProductId) : null)
  if (rate == null) return null
  const commission = Math.round((Number(orderAmount) || 0) * rate)
  if (commission <= 0) return null
  return {
    commission,
    primaryProductId: fallbackProductId != null ? Number(fallbackProductId) : null,
    primaryProductName: fallbackProductName ?? null,
    eligibleLines: 1,
  }
}

export async function creditAffiliateForOrder(
  DB: D1Database,
  env: unknown,
  input: AffiliateCreditInput,
  opts?: { amountOverride?: number },
): Promise<AffiliateCreditResult> {
  const { referrerId, orderId, productId, productName, buyerIp } = input
  try {
    // 🛑 2026-08-22 대표 확정: "어필리에이트 전략은 빼려고 해. 심플하게" — 유저/큐레이터 추천 링크
    //   커미션(2%) 프로그램 종료. 인플루언서 수익은 매장 제안 커미션(seller_influencer_deals)만.
    //   재개 스위치: platform_settings.affiliate_program_enabled = 'true' (행 부재 = 꺼짐).
    //   의도 저장(order_referrer_intents)·per-product referral 설정은 보존 — 스위치만 닫는다.
    const sw = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'affiliate_program_enabled'"
    ).first<{ value: string }>().catch(() => null)
    if (sw?.value !== 'true') return { ok: false, code: 'PROGRAM_DISABLED' }

    const order = await DB.prepare(
      'SELECT id, user_id, total_amount, status FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; user_id: string | number; total_amount: number; status: string }>()
    if (!order) return { ok: false, code: 'NOT_FOUND' }

    const orderStatus = (order.status || '').toUpperCase()
    if (!['DONE', 'PAID'].includes(orderStatus)) return { ok: false, code: 'NOT_PAID' }

    if (String(referrerId) === String(order.user_id)) {
      await DB.prepare(
        `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
         VALUES ('self_referral', ?, 'order', ?, ?, 'high')`
      ).bind(String(referrerId), String(order.id), JSON.stringify({ buyer_id: order.user_id })).run().catch(() => {})
      return { ok: false, code: 'SELF_REFERRAL' }
    }

    try {
      const sellerOwner = await DB.prepare(
        `SELECT s.linked_user_id AS user_id FROM orders o JOIN sellers s ON o.seller_id = s.id WHERE o.id = ? LIMIT 1`
      ).bind(order.id).first<{ user_id: string }>()
      if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(order.user_id)) {
        await DB.prepare(
          `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
           VALUES ('self_purchase', ?, 'order', ?, ?, 'high')`
        ).bind(String(order.user_id), String(order.id), JSON.stringify({ sellerOwner, referrer_id: referrerId })).run().catch(() => {})
        return { ok: false, code: 'SELF_PURCHASE' }
      }
      // 💸 2026-07-07 (대표 결정 — 진입=세션 귀속의 이중지급 방지 가드): referrer 가 곧 상품의 판매자(셀러 소유주)면
      //   추천 수수료를 지급하지 않는다 — 그는 이미 '판매수익'을 가져가므로(자기 유어샵에서 자기 상품 판매).
      //   유어샵 진입 세션귀속(affiliate_ref=주인 user_id)이 도입되며, 주인이 자기 상품을 팔면 referrer==셀러가
      //   되어 판매수익+추천수수료 이중지급이 발생하던 것을 구조적으로 차단. (핀=타인 상품은 referrer≠셀러라 무영향.)
      if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(referrerId)) {
        return { ok: false, code: 'SELF_SELLER' }
      }
    } catch { /* */ }

    const existing = await DB.prepare(
      'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
    ).bind(String(referrerId), order.id).first()
    if (existing) return { ok: false, code: 'DUPLICATE' }

    if (buyerIp) {
      const recentFromIp = await DB.prepare(`
        SELECT COUNT(*) AS cnt FROM affiliate_earnings
        WHERE referrer_id = ? AND buyer_ip = ? AND created_at > datetime('now', '-24 hours')
      `).bind(String(referrerId), buyerIp).first<{ cnt: number }>()
      if (recentFromIp && recentFromIp.cnt >= 3) return { ok: false, code: 'IP_ABUSE' }
    }

    const orderAmount = Number(order.total_amount) || 0
    // 🧾 라인별 귀속 (멀티상품 정확) — order_items 의 referral_enabled 라인만 각 비율로 합산.
    const breakdown = await computeOrderCommission(DB, Number(order.id), orderAmount, productId, productName)
    if (!breakdown) return { ok: false, code: 'REFERRAL_DISABLED' }
    // 💸 2026-07-04 [INV-CB] amountOverride: 예산 아비터가 배분한 상한 — 계산값보다 커질 수 없음(축소만).
    //   0 이면 적립 자체를 스킵(예산 소진). 미전달 시 현행 동일.
    let commission = breakdown.commission
    if (opts?.amountOverride != null) {
      commission = Math.min(Math.max(0, Math.floor(opts.amountOverride)), commission)
      if (commission <= 0) return { ok: false, code: 'BUDGET_EXHAUSTED' }
    }

    // 🛡️ 2026-07-12 (§0-3 referrer 일/월 적립 캡 — flip 선행 조건, 대표 [UNLOCK]):
    //   self 체크가 전부 user_id 동일성 기반이라 **부계정이면 무방비**(pre-flip-risk-audit §③-2).
    //   기기지문/그래프 없이도 폭주를 구조적으로 막는 최소가드 = referrer 단위 금액 캡.
    //   게이트: platform_settings.affiliate_referrer_daily_cap_krw / _monthly_cap_krw —
    //   미설정/0/파싱실패 = 무제한(현행 그대로, OFF-parity). 초과 시 미적립 + 어뷰즈 기록(관측).
    try {
      const readCap = async (key: string): Promise<number> => {
        const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
          .bind(key).first<{ value: string }>().catch(() => null)
        const n = Number(row?.value)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
      }
      const dailyCap = await readCap('affiliate_referrer_daily_cap_krw')
      const monthlyCap = await readCap('affiliate_referrer_monthly_cap_krw')
      if (dailyCap > 0 || monthlyCap > 0) {
        const sums = await DB.prepare(`
          SELECT
            COALESCE(SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN commission ELSE 0 END), 0) AS day_sum,
            COALESCE(SUM(CASE WHEN created_at > datetime('now', '-30 days') THEN commission ELSE 0 END), 0) AS month_sum
          FROM affiliate_earnings
          WHERE referrer_id = ? AND COALESCE(status, '') != 'refunded'
        `).bind(String(referrerId)).first<{ day_sum: number; month_sum: number }>()
        const daySum = Number(sums?.day_sum) || 0
        const monthSum = Number(sums?.month_sum) || 0
        if ((dailyCap > 0 && daySum + commission > dailyCap) || (monthlyCap > 0 && monthSum + commission > monthlyCap)) {
          await DB.prepare(
            `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
             VALUES ('affiliate_referrer_cap', ?, 'order', ?, ?, 'medium')`
          ).bind(String(referrerId), String(order.id), JSON.stringify({ daySum, monthSum, commission, dailyCap, monthlyCap })).run().catch(() => {})
          return { ok: false, code: 'REFERRER_CAP' }
        }
      }
    } catch { /* 캡 판정 실패 → 현행(적립 진행) — 가용성 우선, 관측은 이상탐지 cron 이 보완 */ }

    const storeProductId = breakdown.primaryProductId
    const storeProductName = breakdown.primaryProductName

    // ⏳ 확정 유예(hold): status='holding' 으로만 기록 — 잔액(user_points)은 아직 미반영(= '적립 예정').
    //   확정(granted+잔액) 시점(대표 결정 2026-06-17 "예정→사용 시 확정"):
    //     • 교환권 주문 → 구매자가 매장에서 실제 사용(QR/PIN)한 시점 (matureAffiliateForOrder), 미사용 만료분은 cron.
    //     • 비교환권 주문(실물 등) → T+holdDays 경과(matureAffiliateEarnings cron).
    //   이유: 즉시 잔액 적립 시 buy→출금/사용→환불 어뷰즈에서 MAX(0,...) clamp 로 회수 불가(누수).
    //   hold 동안은 출금 가용액 SUM 에서도 제외(NOT IN ('refunded','holding')) → 출금 불가.
    // 🔐 멱등 = UNIQUE(referrer_id, order_id) + INSERT OR IGNORE (머니룰 #3) — 위 SELECT 는 빠른 경로,
    //   이 가드가 동시요청 race 를 원자적으로 차단(changes===0 = 이미 적립됨 → 잔액/알림 없이 멱등 반환).
    const ins = await DB.prepare(`
      INSERT OR IGNORE INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, buyer_ip, order_amount, commission, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'holding')
    `).bind(
      String(referrerId), order.id, storeProductId, storeProductName,
      String(order.user_id), buyerIp || null, orderAmount, commission,
    ).run()
    if (((ins as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) {
      return { ok: false, code: 'DUPLICATE' }
    }

    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'affiliate_earning', ?, ?, '/u/me/earnings', datetime('now'))
    `).bind(String(referrerId), '🕒 적립 예정', `${commission.toLocaleString('ko-KR')}딜 적립 예정 (확정 시 알림드려요)`).run().catch(() => {})

    try {
      const { sendSystemPush } = await import('../../lib/system-push')
      await sendSystemPush(env as never, 'user', String(referrerId), {
        title: '🕒 적립 예정',
        body: `${commission.toLocaleString('ko-KR')}딜 적립 예정 (확정 시 알림)`,
        url: '/u/me/earnings',
        tag: `affiliate-${order.id}`,
      })
    } catch { /* push fail-soft */ }

    // 📣 실시간 판매 알림톡(크리에이터 잔존 장치 — 2026-07-21 대표): "내 링크가 돈이 됐다"는 즉각 피드백이
    //   두 번째 게시를 만든다(쿠팡파트너스 리텐션 핵심). ⚠️ 머니 무접촉 — 위 적립(멱등 changes>0 통과분)
    //   뒤에 알림만 additive. 게이트 기본 OFF: 템플릿 'affiliate_sale_credited' 를 카카오/Aligo 콘솔에
    //   등록·승인한 뒤 env AFFILIATE_SALE_ALIMTALK_ENABLED=true. sendSystemAlimtalk 은 키/템플릿 미비 시
    //   fail-soft(skip) + SHA256 dedup·1h rate-limit·일일캡 내장(인앱/웹푸시는 위에서 이미 발송됨).
    if ((env as { AFFILIATE_SALE_ALIMTALK_ENABLED?: string })?.AFFILIATE_SALE_ALIMTALK_ENABLED === 'true') {
      try {
        const phoneRow = await DB.prepare('SELECT phone FROM users WHERE id = ?').bind(String(referrerId)).first<{ phone: string | null }>()
        if (phoneRow?.phone) {
          const dealName = storeProductName ? String(storeProductName).slice(0, 40) : '내 추천 상품'
          // ⚠️ 고정 문구는 docs/kakao-alimtalk-templates.md 의 등록 본문과 **글자 일치** 필수(변수만 치환).
          const msg = `[유어딜] 💰 추천 링크 실시간 적립\n\n회원님의 추천 링크로 '${dealName}' 1건이 판매되어 ${commission.toLocaleString('ko-KR')}딜이 적립 예정입니다.\n\n▶ 내 성과 보기: urdeal.kr/u/me/earnings`
          const { sendSystemAlimtalk } = await import('../../lib/system-alimtalk')
          await sendSystemAlimtalk(env as never, phoneRow.phone, 'affiliate_sale_credited', msg)
        }
      } catch { /* alimtalk fail-soft */ }
    }

    return { ok: true, commission }
  } catch {
    return { ok: false, code: 'ERROR' }
  }
}

const HOLD_DAYS_DEFAULT = 7

/**
 * 🔐 holding → granted 확정 + 잔액 적립 + 알림 (단일 SSOT — cron / 사용시 인라인 공용).
 *   claim-before-credit: CAS(meta.changes===1) 통과한 행만 적립 → 동시/중복 차단(머니룰 #1).
 *   반환: 적립된 금액(확정 실패/중복/0원이면 0).
 */
async function grantHoldingEarning(
  DB: D1Database,
  env: unknown,
  row: { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null },
): Promise<number> {
  const claim = await DB.prepare(
    "UPDATE affiliate_earnings SET status = 'granted' WHERE id = ? AND COALESCE(status, 'pending') = 'holding'",
  ).bind(row.id).run().catch(() => null)
  if ((((claim as { meta?: { changes?: number } } | null)?.meta?.changes) ?? 0) !== 1) return 0
  const amt = Number(row.commission) || 0
  if (amt <= 0) return 0
  await adjustUserPoints(DB, {
    userId: String(row.referrer_id),
    delta: amt,
    type: 'affiliate_commission',
    description: row.product_name ? `핀 추천 적립 확정 (${String(row.product_name).slice(0, 80)})` : '핀 추천 적립 확정',
    orderId: row.order_id ?? undefined,
  })
  await DB.prepare(`
    INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
    VALUES (?, 'affiliate_earning', ?, ?, '/u/me/earnings', datetime('now'))
  `).bind(String(row.referrer_id), '✅ 적립 확정!', `${amt.toLocaleString('ko-KR')}딜이 확정되었습니다`).run().catch(() => {})
  try {
    const { sendSystemPush } = await import('../../lib/system-push')
    await sendSystemPush(env as never, 'user', String(row.referrer_id), {
      title: '✅ 적립 확정!',
      body: `${amt.toLocaleString('ko-KR')}딜이 확정되었습니다`,
      url: '/u/me/earnings',
      tag: `affiliate-mature-${row.id}`,
    })
  } catch { /* push fail-soft */ }
  return amt
}

/**
 * 🆕 2026-06-17 (대표 결정 "둘 다 — 예정→사용 시 확정"): 교환권을 실제 사용(QR/PIN)한 시점에
 *   해당 주문의 holding 추천적립을 즉시 확정(granted)+잔액 적립. group-buy-voucher 사용 핸들러가 호출.
 *   멱등(CAS) — cron 안전망과 동시 실행돼도 한 번만 확정. 반환: 적립 금액 합.
 *
 * 🛡️ 2026-07-12 (§0-1 매장 공모 콤보 차단 — flip 선행 조건, 대표 [UNLOCK]):
 *   `use-by-seller`(매장 QR 스캔)가 실거래 증빙 없이 holding 을 **즉시 확정**시키는 경로라,
 *   promo 가 커지면 [부계정 구매 → 공모 매장이 바로 사용처리 → 즉시 확정 → 환불창 무력화] 콤보의
 *   기대수익이 양수가 됨. 게이트: `platform_settings.affiliate_use_mature_min_hours` (기본 0 =
 *   현행 즉시확정 그대로). N>0 이면 **구매 후 N시간 이내의 사용은 즉시확정을 보류** — holding 유지,
 *   기존 T+7 성숙 cron(matureAffiliateEarnings — 주문상태 가드 포함)이 안전망으로 확정.
 *   미지급이 아니라 '지연'이라 정직 모델 유지 + 환불창이 어뷰즈를 잡을 시간을 확보.
 */
export async function matureAffiliateForOrder(DB: D1Database, env: unknown, orderId: number): Promise<number> {
  try {
    // §0-1 게이트 — 설정 없음/0/파싱실패 = 현행(즉시확정).
    let minHours = 0
    try {
      const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_use_mature_min_hours'")
        .first<{ value: string }>()
      const n = Number(row?.value)
      if (Number.isFinite(n) && n > 0) minHours = n
    } catch { /* 현행 */ }
    const cutoffIso = minHours > 0 ? new Date(Date.now() - minHours * 3600_000).toISOString() : null

    const due = await DB.prepare(`
      SELECT ae.id, ae.referrer_id, ae.commission, ae.order_id, ae.product_name
      FROM affiliate_earnings ae
      JOIN orders o ON o.id = ae.order_id
      WHERE ae.order_id = ? AND COALESCE(ae.status, 'pending') = 'holding'
        AND UPPER(COALESCE(o.status, '')) NOT IN ('REFUNDED', 'CANCELLED', 'FAILED')
        ${cutoffIso ? 'AND o.created_at <= ?' : ''}
    `).bind(...(cutoffIso ? [orderId, cutoffIso] : [orderId])).all<{ id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }>()
      .catch(() => ({ results: [] as { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }[] }))
    let credited = 0
    for (const row of due.results ?? []) credited += await grantHoldingEarning(DB, env, row)
    return credited
  } catch { return 0 }
}

/**
 * ⏳ 추천 적립 성숙 cron — 대표 결정(2026-06-17 "예정→사용 시 확정")으로 정책 분기:
 *   • 교환권 주문: 교환권이 실제 사용('used')/만료('expired' 또는 expires_at 경과)되면 확정.
 *     → 평소엔 사용 시점에 matureAffiliateForOrder 가 즉시 확정하고, 이 cron 은 누락분+만료분 안전망.
 *     (미사용·미만료 교환권은 계속 holding = '적립 예정' 유지 — 실제 써야 확정되는 정직 모델.)
 *   • 비교환권 주문(실물 배송 등 '사용' 이벤트 없음): 기존대로 T+holdDays 경과로 확정.
 *   claim-before-credit CAS + 주문 status 가드(REFUNDED/CANCELLED/FAILED 제외). policy: affiliate_hold_days.
 */
export async function matureAffiliateEarnings(
  DB: D1Database,
  env: unknown,
): Promise<{ matured: number; credited: number }> {
  let holdDays = HOLD_DAYS_DEFAULT
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_hold_days'").first<{ value: string }>()
    const n = Number(row?.value)
    if (Number.isFinite(n) && n >= 0) holdDays = n
  } catch { /* default */ }

  // 🛡️ 2026-07-12 (§0-1 짝 — matureAffiliateForOrder 의 min-hours 게이트와 동일):
  //   사용 즉시확정을 N시간 보류해도 이 cron 이 다음 틱에 v.status='used' 로 바로 확정하면
  //   게이트가 무력화됨 → **used 분기에만** 같은 cutoff(주문 N시간 경과) 적용.
  //   expired/만료 분기는 어뷰즈 벡터가 아니고(사용 안 함) 정직하게 즉시 확정 유지.
  let useMatureMinHours = 0
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_use_mature_min_hours'")
      .first<{ value: string }>()
    const n = Number(row?.value)
    if (Number.isFinite(n) && n > 0) useMatureMinHours = n
  } catch { /* 현행 */ }
  const usedCutoffIso = useMatureMinHours > 0 ? new Date(Date.now() - useMatureMinHours * 3600_000).toISOString() : null

  let matured = 0
  let credited = 0
  try {
    const due = await DB.prepare(`
      SELECT ae.id, ae.referrer_id, ae.commission, ae.order_id, ae.product_name
      FROM affiliate_earnings ae
      JOIN orders o ON o.id = ae.order_id
      WHERE COALESCE(ae.status, 'pending') = 'holding'
        AND UPPER(COALESCE(o.status, '')) NOT IN ('REFUNDED', 'CANCELLED', 'FAILED')
        AND (
          EXISTS (
            SELECT 1 FROM vouchers v WHERE v.order_id = ae.order_id
              AND ( (v.status = 'used' ${usedCutoffIso ? 'AND o.created_at <= ?' : ''})
                    OR v.status = 'expired'
                    OR (v.status = 'unused' AND v.expires_at IS NOT NULL AND v.expires_at < datetime('now')) )
          )
          OR (
            NOT EXISTS (SELECT 1 FROM vouchers v2 WHERE v2.order_id = ae.order_id)
            AND ae.created_at <= datetime('now', ?)
          )
        )
      LIMIT 500
    `).bind(...(usedCutoffIso ? [usedCutoffIso, `-${holdDays} days`] : [`-${holdDays} days`])).all<{ id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }>()
      .catch(() => ({ results: [] as { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }[] }))

    for (const row of due.results ?? []) {
      const amt = await grantHoldingEarning(DB, env, row)
      if (amt > 0) { matured++; credited += amt }
    }
  } catch { /* fail-soft */ }
  return { matured, credited }
}

/** 주문 생성 시 추천 의도 저장 (결제 확정 시 creditAffiliateForOrder 가 소비). */
const _done_intents = new WeakSet<D1Database>()
export async function ensureReferrerIntentsTable(DB: D1Database): Promise<void> {
  if (_done_intents.has(DB)) return
  _done_intents.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_referrer_intents (
      order_id INTEGER PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      buyer_ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
}

export async function saveReferrerIntent(
  DB: D1Database,
  intent: { orderId: number; referrerId: string; productId?: number | null; productName?: string | null; buyerIp?: string | null },
): Promise<void> {
  try {
    await ensureReferrerIntentsTable(DB)
    await DB.prepare(
      'INSERT OR IGNORE INTO order_referrer_intents (order_id, referrer_id, product_id, product_name, buyer_ip) VALUES (?, ?, ?, ?, ?)'
    ).bind(intent.orderId, String(intent.referrerId), intent.productId || null, intent.productName || null, intent.buyerIp || null).run()
  } catch { /* fail-soft */ }
}

/** /confirm 확정 직후 호출 — 저장된 의도가 있으면 적립 (멱등). */
export async function creditAffiliateFromIntent(
  DB: D1Database,
  env: unknown,
  orderId: number,
  opts?: { amountOverride?: number },
): Promise<void> {
  try {
    await ensureReferrerIntentsTable(DB)
    const intent = await DB.prepare(
      'SELECT referrer_id, product_id, product_name, buyer_ip FROM order_referrer_intents WHERE order_id = ?'
    ).bind(orderId).first<{ referrer_id: string; product_id: number | null; product_name: string | null; buyer_ip: string | null }>()
    if (!intent?.referrer_id) return
    await creditAffiliateForOrder(DB, env, {
      referrerId: intent.referrer_id,
      orderId,
      productId: intent.product_id,
      productName: intent.product_name,
      buyerIp: intent.buyer_ip,
    }, opts)
  } catch { /* fail-soft */ }
}

/**
 * 💸 2026-07-04 [INV-CB]: 적립 없이 "이 주문의 핀 추천 요청액"만 계산(read-only) — 예산 아비터용.
 *   intent 없음/셀프추천/이미 적립/비대상이면 0. 일시 오류도 0(미지급 방향 안전).
 *   ⚠️ credit 의 전체 검증(IP 어뷰즈 등)의 부분집합 — 여기서 >0 이어도 credit 이 거부할 수 있음
 *   (그 경우 배정 예산이 남을 뿐, 초과 지급은 구조적으로 불가).
 */
export async function peekAffiliateIntentRequest(DB: D1Database, orderId: number): Promise<number> {
  try {
    await ensureReferrerIntentsTable(DB)
    const intent = await DB.prepare(
      'SELECT referrer_id, product_id, product_name FROM order_referrer_intents WHERE order_id = ?'
    ).bind(orderId).first<{ referrer_id: string; product_id: number | null; product_name: string | null }>()
    if (!intent?.referrer_id) return 0
    const order = await DB.prepare(
      'SELECT id, user_id, total_amount FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; user_id: string | number; total_amount: number }>()
    if (!order) return 0
    if (String(intent.referrer_id) === String(order.user_id)) return 0 // self — credit 도 거부
    const existing = await DB.prepare(
      'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
    ).bind(String(intent.referrer_id), order.id).first().catch(() => null)
    if (existing) return 0 // 이미 적립 — 예산 요청 불필요
    const breakdown = await computeOrderCommission(DB, Number(order.id), Number(order.total_amount) || 0, intent.product_id, intent.product_name)
    return breakdown?.commission ?? 0
  } catch {
    return 0
  }
}
