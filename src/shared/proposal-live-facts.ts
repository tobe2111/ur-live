/**
 * 📄 대외 소개서(덱)의 **라이브 숫자** — 한 곳에서 계산한다 (2026-11-02)
 *
 * 대표 *"제안서는 계속 자동 업데이트가 안돼"* → *"응 진행해줘. 가장 이상적으로."*
 *
 * ## 왜 (실측)
 * 소개서 숫자는 `docs/business/proposals/deck-common.mjs` 의 `FACTS` 에 **손으로 적은 그날의 측정값**
 * 이었다. 2026-11-02 에 라이브를 다시 재니 이미 어긋나 있었다:
 *   판매 중 이용권 165 → **160** · 식사 평균 판매가 32,521 → **33,724** · 숙박 155,693 → **147,800**.
 * 다시 재고 다시 뽑는 사람이 없으면 덱은 낡은 숫자를 계속 말한다. ⇒ 숫자는 **빌드할 때 라이브에서** 읽는다.
 *
 * ## 정의 (2026-10-12 · 10-31 세션이 손으로 잰 정의를 그대로 옮겼다 — 바꾸지 말 것)
 *   - 판매 중 이용권 = `is_active=1 · deal_only=0 · 이용권 4종(식사·뷰티·숙박·기타)`
 *   - 실제 매장 이용권 = 그중 `seller_id` 가 있고 데모 슬러그(`demo-`)가 아닌 것의 **건수**
 *   - 평균 = **판매가(`price`) 평균** — 정가 평균이 아니다(10-12 세션이 한 번 헷갈렸다: 정가면 40,757)
 *   - 셈법 예시 상품 = 앵커 id(`PROPOSAL_SAMPLE_PRODUCT_ID`). 앵커가 내려가면 다른 실제 매장 식사 이용권으로
 *     바꾸고 `sampleMoved` 를 켠다 — 10-06 에 앵커(2888)가 내려갔는데 덱이 "지금 팔리는 상품" 이라고 계속 말했다.
 *
 * ## 못 보는 것
 *   - 인플루언서 DB 규모(30만 행 넘는 COUNT 는 공개 API 에서 돌리기엔 비싸다) — 덱에 기준일과 함께 손으로 남는다
 *   - 문장(설명)이 맞는지 — 대신 설정 스위치(`flags`)를 같이 내보내 빌드가 "덱이 말하는 것 ≠ 설정" 을 경고한다
 */

export const PROPOSAL_SAMPLE_PRODUCT_ID = 2915
/** 상품명이 길면 슬라이드에 짧은 이름을 쓴다(앵커가 바뀌면 원래 이름을 그대로 쓴다). */
export const PROPOSAL_SAMPLE_DISPLAY_NAME: Readonly<Record<number, string>> = {
  2915: '프리미엄 돈가스 1인 세트',
}

export const PROPOSAL_CATALOG_CATEGORIES = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher'] as const
export type ProposalCatalogKey = 'meal' | 'beauty' | 'stay' | 'etc'

const CAT_KEY: Record<(typeof PROPOSAL_CATALOG_CATEGORIES)[number], ProposalCatalogKey> = {
  meal_voucher: 'meal',
  beauty_voucher: 'beauty',
  stay_voucher: 'stay',
  etc_voucher: 'etc',
}

const CAT_IN = PROPOSAL_CATALOG_CATEGORIES.map((c) => `'${c}'`).join(',')
const ACTIVE = `is_active = 1 AND COALESCE(deal_only, 0) = 0 AND category IN (${CAT_IN})`
const REAL = `seller_id IS NOT NULL AND COALESCE(slug, '') NOT LIKE 'demo-%'`

/** 워커가 그대로 돌리는 SQL — 시험이 정의를 고정한다. 전부 products 한 테이블(수천 행)이다. */
export const PROPOSAL_FACTS_SQL = {
  counts: `SELECT COUNT(*) AS active, SUM(CASE WHEN ${REAL} THEN 1 ELSE 0 END) AS real_stores FROM products WHERE ${ACTIVE}`,
  averages: `SELECT category, ROUND(AVG(price)) AS avg FROM products WHERE ${ACTIVE} GROUP BY category`,
  anchor: `SELECT id, name, price, original_price, is_active FROM products WHERE id = ?`,
  fallback: `SELECT id, name, price, original_price, is_active FROM products
             WHERE ${ACTIVE} AND ${REAL} AND category = 'meal_voucher' AND original_price > price ORDER BY id LIMIT 1`,
  settings: `SELECT key, value FROM platform_settings WHERE key IN ('broker_share_enabled','payout_requires_voucher_use','fee_channel_rates_enabled','influencer_payout_min')`,
} as const

export interface SampleRow {
  id: number
  name: string
  price: number
  original_price: number | null
  is_active: number
}

export interface ProposalLiveFacts {
  /** KST 날짜(YYYY-MM-DD) — 덱의 "○○ 기준" 문구 */
  measuredAt: string
  activeVouchers: number
  realStores: number
  avg: Record<ProposalCatalogKey, number | null>
  sample: { id: number; name: string; orig: number; price: number } | null
  /** 앵커 상품이 내려가 다른 상품으로 바꿨다 — 빌드가 경고로 올린다 */
  sampleMoved: boolean
  /** 덱 문장이 기대는 설정. null = 행이 없다(모름) — false 와 섞지 않는다 */
  flags: {
    brokerShareEnabled: boolean | null
    payoutRequiresVoucherUse: boolean | null
    feeChannelRatesEnabled: boolean | null
  }
  influencerPayoutMin: number | null
}

function flag(v: string | undefined): boolean | null {
  if (v == null) return null
  return v === 'true' || v === '1'
}

/** KST 날짜 — 서버가 UTC 라 그대로 자르면 아침 9시 전에 하루 밀린다. */
export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 순수 — DB 결과를 덱이 쓰는 모양으로. 시험이 직접 돌린다. */
export function shapeProposalFacts(x: {
  counts: { active: number | null; real_stores: number | null } | null
  averages: Array<{ category: string; avg: number | null }>
  anchor: SampleRow | null
  fallback: SampleRow | null
  settings: Array<{ key: string; value: string }>
  now: Date
}): ProposalLiveFacts {
  const avg: Record<ProposalCatalogKey, number | null> = { meal: null, beauty: null, stay: null, etc: null }
  for (const r of x.averages) {
    const k = CAT_KEY[r.category as keyof typeof CAT_KEY]
    if (k && r.avg != null) avg[k] = Math.round(Number(r.avg))
  }
  const usable = (r: SampleRow | null) =>
    !!r && r.is_active === 1 && Number(r.original_price) > Number(r.price) && Number(r.price) > 0
  const anchorOk = usable(x.anchor)
  const pick = anchorOk ? x.anchor : usable(x.fallback) ? x.fallback : null
  const s = Object.fromEntries(x.settings.map((r) => [r.key, r.value]))
  const payoutMin = Number(s.influencer_payout_min)
  return {
    measuredAt: kstDate(x.now),
    activeVouchers: Number(x.counts?.active ?? 0),
    realStores: Number(x.counts?.real_stores ?? 0),
    avg,
    sample: pick
      ? {
          id: pick.id,
          name: PROPOSAL_SAMPLE_DISPLAY_NAME[pick.id] ?? pick.name,
          orig: Number(pick.original_price),
          price: Number(pick.price),
        }
      : null,
    sampleMoved: !anchorOk,
    flags: {
      brokerShareEnabled: flag(s.broker_share_enabled),
      payoutRequiresVoucherUse: flag(s.payout_requires_voucher_use),
      feeChannelRatesEnabled: flag(s.fee_channel_rates_enabled),
    },
    influencerPayoutMin: Number.isFinite(payoutMin) && payoutMin > 0 ? payoutMin : null,
  }
}
