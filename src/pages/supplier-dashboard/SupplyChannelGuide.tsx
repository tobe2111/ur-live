/**
 * 🏭 2026-06-12 (영업단 제안): 공급가 수준별 "제안 가능 유통채널" 실시간 안내.
 *
 *   상품 등록/가격 수정 폼의 가격 입력 아래에서 공급률·이익여력과 함께
 *   열린 채널(✓)/잠긴 채널(임계 공급률)을 보여주고, 잠긴 채널 중 가장 가까운 것의
 *   "₩X 이하로 낮추면 △△까지 열려요" nudge 를 띄운다 — 강요가 아닌 잠금해제 프레임.
 *
 *   임계값은 서버(platform_settings — 영업단이 어드민에서 조정)에서 읽음. 모듈 캐시로
 *   모달 재오픈 시 재요청 없음. 로드 실패 시 SSOT 기본값 폴백(안내 자체는 항상 동작).
 *   ⚠️ 표시 전용 — 실제 제안/노출 배선(Phase 2)은 별도. 과약속 방지 디스클레이머 포함.
 */
import { useState, useEffect } from 'react'
import { supplierApi } from '@/lib/supplier-api'
import { formatWon } from '@/utils/format'
import {
  DEFAULT_SUPPLY_CHANNEL_THRESHOLDS,
  type SupplyChannelThresholds,
  supplyRatePct,
  evaluateSupplyChannels,
  nextLockedChannel,
} from '@/shared/supply-channels'

// 모듈 캐시 — 세션 내 1회 fetch (영업단 기준 변경은 새로고침/재로그인 시 반영이면 충분).
let _thresholdsCache: SupplyChannelThresholds | null = null
let _thresholdsInflight: Promise<SupplyChannelThresholds> | null = null

function fetchThresholds(): Promise<SupplyChannelThresholds> {
  if (_thresholdsCache) return Promise.resolve(_thresholdsCache)
  if (_thresholdsInflight) return _thresholdsInflight
  _thresholdsInflight = supplierApi
    .get<{ thresholds: SupplyChannelThresholds }>('/api/supplier/channel-thresholds')
    .then(res => {
      _thresholdsCache = res.thresholds || DEFAULT_SUPPLY_CHANNEL_THRESHOLDS
      return _thresholdsCache
    })
    .catch(() => DEFAULT_SUPPLY_CHANNEL_THRESHOLDS) // 실패해도 안내는 기본값으로 동작
    .finally(() => { _thresholdsInflight = null })
  return _thresholdsInflight
}

export default function SupplyChannelGuide({ supplyPrice, retailPrice, t }: {
  supplyPrice: string | number
  retailPrice: string | number
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const [thresholds, setThresholds] = useState<SupplyChannelThresholds>(
    _thresholdsCache || DEFAULT_SUPPLY_CHANNEL_THRESHOLDS,
  )
  useEffect(() => {
    let alive = true
    fetchThresholds().then(th => { if (alive) setThresholds(th) })
    return () => { alive = false }
  }, [])

  const rate = supplyRatePct(supplyPrice, retailPrice)
  // 두 가격이 모두 유효해질 때까지는 입력 유도 한 줄만 (폼 소음 최소화).
  if (rate === null) {
    return (
      <p className="text-[11px] text-gray-400 mt-1">
        {t('supplier.channelGuideHint', { defaultValue: '공급가와 권장 소비자가를 입력하면 제안 가능한 유통채널을 보여드려요.' })}
      </p>
    )
  }

  const retail = Number(retailPrice)
  const supply = Number(supplyPrice)
  const evals = evaluateSupplyChannels(rate, thresholds, retail)
  const next = nextLockedChannel(evals)
  const margin = Math.max(0, retail - supply)
  const inverted = supply > retail // 공급가 > 권장가 — 역마진 입력 실수 경고

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-gray-700">
          {t('supplier.channelGuideRate', { defaultValue: '공급률' })}{' '}
          <span className={`text-[14px] font-extrabold ${inverted ? 'text-red-600' : 'text-gray-900'}`}>{rate}%</span>
        </p>
        <p className="text-[11px] text-gray-500">
          {t('supplier.channelGuideMargin', { defaultValue: '셀러 마진 여력' })}{' '}
          <span className="font-bold text-gray-700">{formatWon(margin)}</span>
        </p>
      </div>

      {inverted ? (
        <p className="text-[11px] font-semibold text-red-600 mt-2">
          {t('supplier.channelGuideInverted', { defaultValue: '공급가가 권장 소비자가보다 높아요 — 입력을 확인해주세요.' })}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {evals.map(ch => (
              <span key={ch.key}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border ${
                  ch.eligible
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}>
                {ch.emoji} {ch.label}
                {ch.eligible
                  ? <span aria-hidden>✓</span>
                  : <span className="font-medium">· {ch.threshold}%↓</span>}
              </span>
            ))}
          </div>

          {next && (
            <p className="text-[11px] font-semibold text-[#FC5424] mt-2">
              {t('supplier.channelGuideNudge', {
                defaultValue: '공급가를 {{price}} 이하로 낮추면 {{channel}} 채널까지 제안 가능해져요!',
                price: formatWon(next.maxSupplyPrice),
                channel: next.label,
              })}
            </p>
          )}
          {!next && (
            <p className="text-[11px] font-semibold text-emerald-700 mt-2">
              {t('supplier.channelGuideAllOpen', { defaultValue: '모든 유통채널에 제안 가능한 공급가예요. 👍' })}
            </p>
          )}
        </>
      )}

      <p className="text-[10px] text-gray-400 mt-2">
        {t('supplier.channelGuideDisclaimer', { defaultValue: '채널별 제안 가능 기준 안내이며, 실제 제안·노출은 채널 상황과 운영 검토에 따라 달라질 수 있어요.' })}
      </p>
    </div>
  )
}
