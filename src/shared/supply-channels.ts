/**
 * 🏭 2026-06-12 (영업단 제안): 공급가 수준별 "제안 가능 유통채널" 안내 — SSOT.
 *
 *   목적: 제조사가 공급가를 처음부터 높게 앵커링하는 것을 견제. 등록 폼에서
 *   "지금 공급률이면 오픈마켓·공동구매, X% 이하로 낮추면 특판·폐쇄몰까지" 를
 *   실시간으로 보여줘 스스로 낮추게 유도(잠금해제 프레임 — 강요 아닌 안내).
 *
 *   공급률(%) = 공급가 / 권장 소비자가 × 100. 낮을수록 더 많은 채널이 열림.
 *   임계값은 하드코딩 금지 — platform_settings('supply_channel_thresholds') 에서
 *   어드민(영업단)이 조정. 아래 DEFAULT 는 영업단 확정 전 시작값일 뿐.
 *
 *   ⚠️ 순수 모듈 (의존성 0) — 클라이언트(등록 폼)·워커(API)·테스트가 공유.
 *   ⚠️ 표시 전용 레이어 — 결제가/등급가/visibility 게이트에는 영향 없음.
 */

export const SUPPLY_CHANNEL_THRESHOLDS_KEY = 'supply_channel_thresholds'

export type SupplyChannelKey = 'openmarket' | 'groupbuy' | 'special' | 'closedmall'

export interface SupplyChannelDef {
  key: SupplyChannelKey
  /** 한국어 라벨 — B2B 국내 전용 surface (도매 i18n 보류 방침과 일관) */
  label: string
  emoji: string
  /** 기본 임계 공급률(%) — 공급률이 이 값 이하일 때 제안 가능 */
  defaultThreshold: number
}

// 순서 = 낮은 공급가 요구가 약한 채널 → 강한 채널 (UI 표시 순서로도 사용).
export const SUPPLY_CHANNELS: readonly SupplyChannelDef[] = [
  { key: 'openmarket', label: '오픈마켓', emoji: '🛒', defaultThreshold: 90 },
  { key: 'groupbuy', label: '공동구매', emoji: '👥', defaultThreshold: 85 },
  { key: 'special', label: '특판', emoji: '🎯', defaultThreshold: 75 },
  { key: 'closedmall', label: '폐쇄몰', emoji: '🔒', defaultThreshold: 70 },
] as const

export type SupplyChannelThresholds = Record<SupplyChannelKey, number>

export const DEFAULT_SUPPLY_CHANNEL_THRESHOLDS: SupplyChannelThresholds = Object.fromEntries(
  SUPPLY_CHANNELS.map(ch => [ch.key, ch.defaultThreshold]),
) as SupplyChannelThresholds

/** platform_settings 저장값(JSON 문자열) → 임계값. 깨졌거나 누락된 키는 기본값 폴백. */
export function parseChannelThresholds(raw: string | null | undefined): SupplyChannelThresholds {
  const out: SupplyChannelThresholds = { ...DEFAULT_SUPPLY_CHANNEL_THRESHOLDS }
  if (!raw) return out
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const ch of SUPPLY_CHANNELS) {
      const v = Number(parsed?.[ch.key])
      if (Number.isFinite(v) && v >= 1 && v <= 100) out[ch.key] = v
    }
  } catch { /* 깨진 JSON → 기본값 */ }
  return out
}

/** 공급률(%) — 입력이 유효하지 않으면 null (UI 는 안내 숨김). 소수 1자리. */
export function supplyRatePct(supplyPrice: unknown, retailPrice: unknown): number | null {
  const supply = Number(supplyPrice)
  const retail = Number(retailPrice)
  if (!Number.isFinite(supply) || !Number.isFinite(retail) || supply <= 0 || retail <= 0) return null
  return Math.round((supply / retail) * 1000) / 10
}

export interface SupplyChannelEval extends SupplyChannelDef {
  threshold: number
  eligible: boolean
  /** 이 채널이 열리는 공급가 상한(원) — 잠긴 채널의 "₩X 이하로 낮추면" 안내용 */
  maxSupplyPrice: number
}

/** 현재 공급률로 채널별 제안 가능 여부 평가. retailPrice 는 잠긴 채널 목표 공급가 계산용. */
export function evaluateSupplyChannels(
  ratePct: number,
  thresholds: SupplyChannelThresholds,
  retailPrice: number,
): SupplyChannelEval[] {
  return SUPPLY_CHANNELS.map(ch => {
    const threshold = thresholds[ch.key] ?? ch.defaultThreshold
    return {
      ...ch,
      threshold,
      eligible: ratePct <= threshold,
      maxSupplyPrice: Math.floor((retailPrice * threshold) / 100),
    }
  })
}

/** 잠긴 채널 중 가장 가까운(임계값 큰) 것 — "₩X 이하로 낮추면 Y 까지 열려요" nudge 용. */
export function nextLockedChannel(evals: SupplyChannelEval[]): SupplyChannelEval | null {
  const locked = evals.filter(e => !e.eligible)
  if (locked.length === 0) return null
  return locked.reduce((a, b) => (a.threshold >= b.threshold ? a : b))
}
