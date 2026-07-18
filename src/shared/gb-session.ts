/**
 * 🎟️ 공구(group-buy) 상태 세션 — SSOT 순수 모델 (2026-07-06 공구 엔진 완결 스펙 §1)
 *
 * 설계 결정(대표 확정): 공구는 별도 상품 타입이 아니라 **이용권 하나에 얹는 상태**다.
 *   기존 이용권(products.price=상시가, original_price=정가)이 상시 판매되다가, 공구가 켜지면
 *   기간·특가(gb_price)·promo(gb_promo_pct)가 얹히고, 끝나면 상시가·상시 상태로 자동 복귀.
 *   세션 값은 product_supply_meta K-V 에 저장(products 컬럼 예산 동결).
 *
 * ⚠️ 순수 함수(DB/시간 의존 0 — nowMs 는 인자 주입). 테스트로 불변식 영구 고정.
 *   금액/모드 산출만 담당. 실제 저장/조회는 worker/utils/gb-session-store.ts, 정산은 fee-resolver.
 */

export type GbMode = 'off' | 'scheduled' | 'live' | 'ended'

export interface GbSession {
  mode: GbMode
  /** 공구 시작(ISO). scheduled→live 판정. */
  startAt?: string | null
  /** 공구 마감(ISO). live→ended 판정. */
  deadline?: string | null
  /** 목표 수량(선택, 표시용). */
  target?: number | null
  /** 공구 특가(정수 원) — 상시가보다 낮아야 함. */
  price?: number | null
  /** 이 세션의 소개비율 %(0~50). */
  promoPct?: number | null
  /**
   * 카니발라이제이션 규칙:
   *   false(기본) = "공구가로 통일" — 공구 live 동안 상시 구매도 공구가 적용(누구도 더 비싸게 안 삼).
   *   true        = "링크 전용" — 상시 노출 숨김, ?ref 링크로만 공구가(상시 구매는 상시가).
   */
  linkOnly?: boolean
  /** 방향 B(인플루언서 제안→매장 승인)로 열린 경우 제안한 인플루언서 id(우선 노출/전용 링크). */
  proposerId?: string | null
}

/** product_supply_meta 키 이름 (prelaunch 패턴 미러). */
export const GB_META_KEYS = {
  mode: 'gb_mode',
  start: 'gb_start',
  deadline: 'gb_deadline',
  target: 'gb_target',
  price: 'gb_price',
  promo: 'gb_promo_pct',
  linkOnly: 'gb_link_only',
  proposer: 'gb_proposer',
} as const

const OFF: GbSession = { mode: 'off' }

function toIntOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : null
}

/** product_supply_meta 레코드 → GbSession (없으면 off). */
export function parseGbSession(rec: Record<string, string> | undefined | null): GbSession {
  if (!rec) return { ...OFF }
  const rawMode = rec[GB_META_KEYS.mode]
  const mode: GbMode = rawMode === 'scheduled' || rawMode === 'live' || rawMode === 'ended' ? rawMode : 'off'
  if (mode === 'off') return { ...OFF }
  return {
    mode,
    startAt: rec[GB_META_KEYS.start] || null,
    deadline: rec[GB_META_KEYS.deadline] || null,
    target: rec[GB_META_KEYS.target] != null && rec[GB_META_KEYS.target] !== '' ? toIntOrNull(rec[GB_META_KEYS.target]) : null,
    price: rec[GB_META_KEYS.price] != null && rec[GB_META_KEYS.price] !== '' ? toIntOrNull(rec[GB_META_KEYS.price]) : null,
    promoPct: rec[GB_META_KEYS.promo] != null && rec[GB_META_KEYS.promo] !== '' ? Number(rec[GB_META_KEYS.promo]) : null,
    linkOnly: rec[GB_META_KEYS.linkOnly] === '1' || rec[GB_META_KEYS.linkOnly] === 'true',
    proposerId: rec[GB_META_KEYS.proposer] || null,
  }
}

/** GbSession → product_supply_meta setSupplyMeta 값(전 키 명시 — off 는 나머지 null 로 청소). */
export function gbSessionToMeta(s: GbSession): Record<string, string | number | null> {
  if (s.mode === 'off') {
    return { [GB_META_KEYS.mode]: 'off', [GB_META_KEYS.start]: null, [GB_META_KEYS.deadline]: null,
      [GB_META_KEYS.target]: null, [GB_META_KEYS.price]: null, [GB_META_KEYS.promo]: null,
      [GB_META_KEYS.linkOnly]: null, [GB_META_KEYS.proposer]: null }
  }
  return {
    [GB_META_KEYS.mode]: s.mode,
    [GB_META_KEYS.start]: s.startAt ?? null,
    [GB_META_KEYS.deadline]: s.deadline ?? null,
    [GB_META_KEYS.target]: s.target ?? null,
    [GB_META_KEYS.price]: s.price ?? null,
    [GB_META_KEYS.promo]: s.promoPct ?? null,
    [GB_META_KEYS.linkOnly]: s.linkOnly ? '1' : '0',
    [GB_META_KEYS.proposer]: s.proposerId ?? null,
  }
}

/**
 * 시각 기준 실효 모드 산출(저장 모드 + 시간창으로 파생). 저장값을 바꾸지 않고 표시/판정용.
 *   scheduled 이고 now ≥ start → live · live 이고 now > deadline → ended · 그 외 저장 모드 유지.
 */
export function resolveGbStatus(s: GbSession, nowMs: number): GbMode {
  if (s.mode === 'off' || s.mode === 'ended') return s.mode
  const start = s.startAt ? Date.parse(s.startAt) : NaN
  const deadline = s.deadline ? Date.parse(s.deadline) : NaN
  if (s.mode === 'scheduled') {
    if (Number.isFinite(start) && nowMs >= start) {
      // 시작은 됐지만 이미 마감도 지났으면 ended
      if (Number.isFinite(deadline) && nowMs > deadline) return 'ended'
      return 'live'
    }
    return 'scheduled'
  }
  // live
  if (Number.isFinite(deadline) && nowMs > deadline) return 'ended'
  return 'live'
}

/** 공구가 지금 실제로 활성(live)인가. */
export function isGbActive(s: GbSession, nowMs: number): boolean {
  return resolveGbStatus(s, nowMs) === 'live'
}

export interface GbPricing {
  /** 상시가(products.price). */
  listPrice: number
  /** 정가(products.original_price, 없으면 listPrice). */
  originalPrice: number
  /** 실효 소비자가 — 공구 live 면 공구가, 아니면 상시가. */
  effectivePrice: number
  /** 공구 live 여부(시각 기준). */
  gbActive: boolean
  /** 이 세션 소개비율(공구 미활성이면 0). */
  promoPct: number
  /** 정가 대비 할인율 %. */
  discountPct: number
  /** 링크 전용 여부(true=상시 노출은 상시가, ?ref 만 공구가). */
  linkOnly: boolean
}

/**
 * 실효 소비자가/promo 산출. 카니발라이제이션 기본 = "공구가로 통일"(linkOnly=false).
 *   viaRefLink: ?ref 링크 경유 여부(linkOnly=true 일 때만 의미 — 링크 경유면 공구가, 아니면 상시가).
 *   기본(linkOnly=false)은 viaRefLink 무관하게 모두 공구가.
 */
export function resolveGbPricing(
  s: GbSession,
  listPrice: number,
  originalPrice: number | null | undefined,
  nowMs: number,
  viaRefLink = false,
): GbPricing {
  const list = Number.isFinite(listPrice) && listPrice > 0 ? Math.floor(listPrice) : 0
  const orig = originalPrice != null && Number.isFinite(originalPrice) && originalPrice > list ? Math.floor(originalPrice) : list
  const active = isGbActive(s, nowMs)
  const gbPrice = s.price != null && Number.isFinite(s.price) ? Math.floor(s.price) : list
  // 링크전용이면 링크 경유일 때만 공구가, 아니면 통일 적용.
  const applyGb = active && gbPrice < list && (!s.linkOnly || viaRefLink)
  const effectivePrice = applyGb ? gbPrice : list
  const promoPct = applyGb && s.promoPct != null && Number.isFinite(s.promoPct) ? Math.max(0, Math.min(50, s.promoPct)) : 0
  const discountPct = orig > effectivePrice ? Math.round((1 - effectivePrice / orig) * 100) : 0
  return { listPrice: list, originalPrice: orig, effectivePrice, gbActive: active, promoPct, discountPct, linkOnly: !!s.linkOnly }
}

/** 공구 세션 유효성 — 열기/수정 시 서버·클라 공용 검증. */
export function validateGbSession(s: GbSession, listPrice: number): { ok: boolean; error?: string } {
  if (s.mode === 'off' || s.mode === 'ended') return { ok: true }
  if (s.price == null || !Number.isFinite(s.price) || s.price <= 0) {
    return { ok: false, error: '공구 특가를 입력해주세요.' }
  }
  if (!(s.price < listPrice)) {
    return { ok: false, error: '공구 특가는 상시가보다 낮아야 합니다.' }
  }
  if (s.promoPct != null && (!Number.isFinite(s.promoPct) || s.promoPct < 0 || s.promoPct > 50)) {
    return { ok: false, error: '소개비율은 0~50% 범위여야 합니다.' }
  }
  const start = s.startAt ? Date.parse(s.startAt) : NaN
  const deadline = s.deadline ? Date.parse(s.deadline) : NaN
  if (!Number.isFinite(deadline)) {
    return { ok: false, error: '공구 마감 일시를 입력해주세요.' }
  }
  if (Number.isFinite(start) && deadline <= start) {
    return { ok: false, error: '마감은 시작 이후여야 합니다.' }
  }
  return { ok: true }
}
