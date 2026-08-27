/**
 * 💸 **실제로 청구되는** 플랫폼 수수료 — 표시와 정산이 갈리지 않게 (2026-08-27)
 *
 * ## 🩸 왜 만들었나 — 화면이 거짓말을 하고 있었다
 * 매장 등록에서 **직접(10%)** 을 고르면 이용권 등록 화면의 "판매 1건당 실수령" 카드가
 * **10% 를 빼고** 보여 줬다. 그런데 결제 시 실제 분배는 `getSellerCommissionRate` 를 쓰고
 * **그 함수는 채널을 보지 않는다** — 매장별 수동 설정 → GMV 티어 → 기본값(5%) 순으로만 정한다.
 *
 * 채널 요율을 원장에 적용하는 경로(`channelPlatformRate`)는 있지만
 * 게이트 `fee_channel_rates_enabled` 뒤이고, **라이브에서 꺼져 있다**(2026-08-27 실측).
 * ⇒ 지금은 직접이든 중개든 **전부 5%** 다.
 *
 * 두 파일의 주석이 각각 *"loadFeeRates SSOT 라 표시·정산이 갈릴 수 없다"* 고 단언하고 있었다.
 * 같은 값을 읽는 건 맞지만 **그 값이 정산에 안 쓰인다** — 문서가 앞서간 전형이다.
 *
 * ## 이 함수의 계약
 * **결제가 쓰는 것과 같은 경로**를 읽어 "지금 이 매장이 실제로 내는 %" 를 돌려준다.
 * 화면은 이것만 쓴다. 설계값(10%)은 `channel_pct` 로 따로 실어 보내되 **청구액 계산에 쓰지 않는다.**
 *
 * ⚠️ 이 함수는 **아무것도 바꾸지 않는다.** 게이트를 켜는 것(직접 10% 를 실제로 받기)은
 *   머니 경로라 대표 결정 + staging 실결제가 필요하다. 여기서 하는 일은 **사실대로 말하는 것**뿐이다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getSellerCommissionRate } from '@/features/group-buy/api/helpers'
import { DEFAULT_FEE_RATES } from './fee-resolver'

export interface EffectiveFee {
  /** 지금 실제로 떼이는 % (결제 분배와 같은 경로). 화면은 이것만 쓴다. */
  pct: number
  /** 등록 유형 — 표시·정책용. 지금은 청구에 영향이 없다. */
  channel: 'direct' | 'brokered'
  /** 채널 요율이 실제로 적용되는가(`fee_channel_rates_enabled`). 꺼져 있으면 `pct` 는 채널과 무관. */
  channelRatesActive: boolean
  /** 채널 요율이 켜졌을 때의 설계값 — 어드민이 갭을 볼 수 있게 함께 싣는다. */
  channelPct: number
}

/** 채널 요율 게이트가 켜져 있는가. 미설정이면 꺼짐(= 종전 동작). */
export async function channelRatesActive(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'fee_channel_rates_enabled'",
  ).first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

export async function getEffectivePlatformFee(
  DB: D1Database,
  sellerId: number,
  channel: 'direct' | 'brokered',
): Promise<EffectiveFee> {
  const [rateFraction, active] = await Promise.all([
    // 🔑 결제가 부르는 바로 그 함수. 여기서 다른 걸 부르면 그 순간 다시 갈린다.
    getSellerCommissionRate(DB, sellerId).catch(() => NaN),
    channelRatesActive(DB),
  ])
  const channelPct = channel === 'direct'
    ? DEFAULT_FEE_RATES.platformPctDirect
    : DEFAULT_FEE_RATES.platformPct

  // 게이트가 켜지면 채널 요율이 우선한다(원장 경로와 같은 판단). 꺼져 있으면 결제 경로 값 그대로.
  const chargedPct = active
    ? channelPct
    : (Number.isFinite(rateFraction) ? rateFraction * 100 : DEFAULT_FEE_RATES.platformPct)

  return {
    pct: Math.round(chargedPct * 100) / 100,
    channel,
    channelRatesActive: active,
    channelPct,
  }
}
