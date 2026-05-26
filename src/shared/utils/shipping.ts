/**
 * 🛡️ 2026-05-25 (migration 0279): 배송비 계산 SSOT V2.
 *
 * 기존 calculateShippingFee (subtotal, baseFee, freeThreshold) 는 V1 — 지역 미고려.
 * V2: 지역별 추가비 (제주/도서산간) + 무료배송 threshold + 합배송 (Phase 6).
 *
 * 영구 룰:
 *   - 정책 변경 시 `policy.ts` SHIPPING_DEFAULTS + `regional_shipping_fees` 테이블만 수정
 *   - postal_code → region 매핑은 본 파일 SSOT
 *   - 클라/서버 양쪽 호환 (Workers + 브라우저)
 */

import { SHIPPING_DEFAULTS } from '../constants/policy'

export type ShippingRegion = 'normal' | 'jeju' | 'island' | 'mountain' | 'unsupported'

export interface ShippingFeeCalcInput {
  subtotal: number
  baseFee: number
  freeShippingThreshold?: number | null
  /** 5자리 우편번호 (한국). 없으면 normal 가정. */
  postalCode?: string | null
  /** regional_shipping_fees 테이블 조회 결과 — 서버 측에서만 전달. 없으면 SHIPPING_DEFAULTS 기본값 사용. */
  regionRules?: ReadonlyArray<{ region_code: string; postal_code_pattern: string; extra_fee: number }>
  /** 상품에 ships_to_jeju=0 같은 플래그가 있는 경우 (옵션). */
  productFlags?: { shipsToJeju?: boolean; shipsToIsland?: boolean }
  /** 🛡️ 2026-05-25 (Phase 6): 합배송. 같은 bundling_key 끼리 baseFee 중복 청구 X.
   *   호출자가 묶음 단위로 호출 — 본 함수는 단일 묶음의 fee 만 계산. */
}

/**
 * 🛡️ 2026-05-25 (Phase 6): 합배송 그룹 단위 배송비 계산.
 *
 * 입력: 카트의 모든 아이템 — 각 { bundling_key, base_fee, subtotal, free_threshold }
 * 묶음 규칙:
 *   - bundling_key 가 같은 아이템 = 1 묶음 (baseFee 1회만)
 *   - NULL bundling_key = 각각 별도 묶음 (단독 배송)
 *   - 묶음 별 baseFee = MAX(아이템 base_fee)
 *   - 묶음 별 무료배송 threshold = MIN(아이템 free_threshold) — 가장 낮은 threshold 사용
 * 지역 추가비는 묶음과 무관 — 한 주문 전체에 1회.
 */
export function calculateBundledShipping(input: {
  items: Array<{ bundling_key: string | null; base_fee: number; subtotal: number; free_threshold: number | null }>
  postalCode?: string | null
  regionRules?: ReadonlyArray<{ region_code: string; postal_code_pattern: string; extra_fee: number }>
}): { groups: Array<{ bundling_key: string | null; itemCount: number; baseFee: number; subtotal: number; effectiveBase: number }>; totalBaseFee: number; regionFee: number; region: ShippingRegion; totalFee: number } {
  // 그룹핑
  const groupMap = new Map<string, { items: typeof input.items; baseFee: number; subtotal: number; freeThreshold: number | null }>()
  for (const item of input.items) {
    // null bundling_key 는 고유 그룹 (단독 배송) — symbol 키 대신 unique string
    const key = item.bundling_key || `__solo_${groupMap.size}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.items.push(item)
      existing.baseFee = Math.max(existing.baseFee, item.base_fee)
      existing.subtotal += item.subtotal
      // 가장 낮은 threshold (가장 관대) — null 우선순위
      if (item.free_threshold !== null) {
        existing.freeThreshold = existing.freeThreshold === null ? item.free_threshold : Math.min(existing.freeThreshold, item.free_threshold)
      }
    } else {
      groupMap.set(key, {
        items: [item],
        baseFee: item.base_fee,
        subtotal: item.subtotal,
        freeThreshold: item.free_threshold,
      })
    }
  }

  const groups: Array<{ bundling_key: string | null; itemCount: number; baseFee: number; subtotal: number; effectiveBase: number }> = []
  let totalBaseFee = 0
  for (const [key, g] of groupMap.entries()) {
    const isFreeShipping = g.freeThreshold !== null && g.subtotal >= g.freeThreshold
    const effectiveBase = isFreeShipping ? 0 : g.baseFee
    groups.push({
      bundling_key: key.startsWith('__solo_') ? null : key,
      itemCount: g.items.length,
      baseFee: g.baseFee,
      subtotal: g.subtotal,
      effectiveBase,
    })
    totalBaseFee += effectiveBase
  }

  const region = detectShippingRegion(input.postalCode, input.regionRules)
  const regionFee = getRegionExtraFee(region, input.regionRules)

  return {
    groups,
    totalBaseFee,
    regionFee,
    region,
    totalFee: totalBaseFee + regionFee,
  }
}

export interface ShippingFeeCalcResult {
  baseFee: number
  regionFee: number
  totalFee: number
  region: ShippingRegion
  freeShippingApplied: boolean
}

/**
 * 우편번호 → 지역 코드.
 * regionRules 가 있으면 그쪽 우선 (DB SSOT). 없으면 hardcoded fallback.
 */
export function detectShippingRegion(
  postalCode: string | null | undefined,
  regionRules?: ReadonlyArray<{ region_code: string; postal_code_pattern: string }>,
): ShippingRegion {
  if (!postalCode) return 'normal'
  const code = String(postalCode).trim().replace(/\D/g, '')
  if (!code) return 'normal'

  // 1차: DB regionRules 우선
  if (regionRules?.length) {
    for (const rule of regionRules) {
      if (matchesPostalPattern(code, rule.postal_code_pattern)) {
        return rule.region_code as ShippingRegion
      }
    }
    return 'normal'
  }

  // 2차: hardcoded fallback (DB 미연결 환경)
  // 제주: 63xxx
  if (code.startsWith('63')) return 'jeju'
  // 울릉도: 40200-40240
  if (code.length === 5) {
    const n = Number(code)
    if (n >= 40200 && n <= 40240) return 'island'
    if (n >= 23004 && n <= 23010) return 'island' // 백령
    if (n >= 23100 && n <= 23129) return 'island' // 연평
    if (n >= 46900 && n <= 46999) return 'island' // 거제 일부
  }
  return 'normal'
}

/**
 * '63%' (LIKE-style) 또는 '40200-40240' (range) 매칭.
 */
function matchesPostalPattern(code: string, pattern: string): boolean {
  if (!pattern) return false
  if (pattern.includes('-')) {
    // range
    const [lo, hi] = pattern.split('-').map(s => Number(s.trim()))
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false
    const n = Number(code)
    return Number.isFinite(n) && n >= lo && n <= hi
  }
  if (pattern.includes('%')) {
    // LIKE prefix
    const prefix = pattern.replace(/%/g, '')
    return code.startsWith(prefix)
  }
  return code === pattern
}

/**
 * 지역별 추가 배송비 (regionRules 우선, fallback policy 기본값).
 */
function getRegionExtraFee(
  region: ShippingRegion,
  regionRules?: ReadonlyArray<{ region_code: string; postal_code_pattern: string; extra_fee: number }>,
): number {
  if (region === 'normal' || region === 'unsupported') return 0
  if (regionRules?.length) {
    const match = regionRules.find(r => r.region_code === region)
    if (match) return match.extra_fee
  }
  // fallback policy
  if (region === 'jeju') return SHIPPING_DEFAULTS.JEJU_EXTRA_FEE
  if (region === 'island' || region === 'mountain') return SHIPPING_DEFAULTS.ISLAND_EXTRA_FEE
  return 0
}

/**
 * 배송비 계산 V2 — 모든 결제 흐름의 SSOT.
 *
 * 호출자:
 *   - 카트 (`/api/cart` GET)
 *   - 체크아웃 (`/api/checkout/calculate`)
 *   - 주문 생성 (`order.routes.ts`)
 *   - 일반 쇼핑 only. voucher / stay / kt_alpha 는 호출 안 함.
 */
export function calculateShippingFeeV2(input: ShippingFeeCalcInput): ShippingFeeCalcResult {
  const baseFee = Math.max(0, Number(input.baseFee) || 0)
  const subtotal = Math.max(0, Number(input.subtotal) || 0)
  const threshold = typeof input.freeShippingThreshold === 'number' ? input.freeShippingThreshold : null

  const region = detectShippingRegion(input.postalCode, input.regionRules)

  // 상품 플래그 체크 (옵션)
  if (
    (region === 'jeju' && input.productFlags?.shipsToJeju === false) ||
    (region === 'island' && input.productFlags?.shipsToIsland === false)
  ) {
    return { baseFee: 0, regionFee: 0, totalFee: 0, region: 'unsupported', freeShippingApplied: false }
  }

  // 무료배송 threshold — 본 fee 만 면제, 지역 추가비는 항상 청구 (관례).
  const freeShippingApplied = threshold !== null && subtotal >= threshold
  const effectiveBase = freeShippingApplied ? 0 : baseFee
  const regionFee = getRegionExtraFee(region, input.regionRules)

  return {
    baseFee: effectiveBase,
    regionFee,
    totalFee: effectiveBase + regionFee,
    region,
    freeShippingApplied,
  }
}
