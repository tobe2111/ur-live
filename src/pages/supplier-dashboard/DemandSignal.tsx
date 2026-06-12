/**
 * 📊 2026-06-12 (사용자 요청 ②④): 수요 신호 — 상품 등록 폼.
 *   ② 네이버쇼핑 클릭 추이(6개월): 상승 🔺 / 하락 🔻 / 보합 ─
 *   ④ 검색 시즌성(24개월): "성수기: 6·7·8월 — 지금 성수기 🔥 / 성수기까지 N개월"
 *   상품명+카테고리 1초 디바운스. 키 미설정·쿼터 소진·데이터 부족이면 **박스 자체를 숨김**
 *   (수요 신호는 보너스 정보 — 에러/빈 박스로 폼을 어지럽히지 않는다).
 */
import { useState, useEffect, useRef } from 'react'
import { supplierApi } from '@/lib/supplier-api'

interface Signal {
  configured?: boolean
  shopping?: { trend: 'up' | 'down' | 'flat'; changePct: number } | null
  season?: { peakMonths: number[]; isSeasonal: boolean } | null
}

// 키 미설정 환경 재호출 방지 — 세션 1회 판정 (NaverPriceCheck 와 동일 패턴).
let _configured: boolean | null = null

/** 성수기 라벨 — 현재 달 기준 위치 표현 (순수). */
export function seasonLabel(peakMonths: number[], nowMonth: number): string {
  if (peakMonths.length === 0) return ''
  const months = peakMonths.map(m => `${m}월`).join('·')
  if (peakMonths.includes(nowMonth)) return `성수기: ${months} — 지금이 성수기예요 🔥`
  // 다음 피크까지 남은 개월 (순환)
  const ahead = peakMonths.map(m => (m - nowMonth + 12) % 12).filter(d => d > 0)
  const next = Math.min(...ahead)
  if (next <= 2) return `성수기: ${months} — ${next}개월 뒤 성수기, 지금 준비 적기예요`
  return `성수기: ${months}`
}

export default function DemandSignal({ name, category, t }: {
  name: string
  category: string
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const [signal, setSignal] = useState<Signal | null>(null)
  const [hidden, setHidden] = useState(_configured === false)
  const lastKey = useRef('')

  useEffect(() => {
    if (_configured === false) return
    const q = name.trim()
    if (q.length < 4) { setSignal(null); return }
    const key = `${category}:${q}`
    if (key === lastKey.current) return
    const tm = setTimeout(() => {
      lastKey.current = key
      supplierApi.get<Signal & { success?: boolean }>(`/api/supplier/demand-signal?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`)
        .then(r => {
          if (r.configured === false) { _configured = false; setHidden(true); return }
          _configured = true
          setSignal(r)
        })
        .catch(() => { /* fail-soft — 숨김 유지 */ })
    }, 1000)
    return () => clearTimeout(tm)
  }, [name, category])

  if (hidden || !signal) return null
  const { shopping, season } = signal
  const hasShopping = !!shopping
  const hasSeason = !!season?.isSeasonal && (season?.peakMonths?.length || 0) > 0
  // 보여줄 신호가 하나도 없으면 박스 자체를 그리지 않음 (쿼터 소진/데이터 부족 시 자연 숨김).
  if (!hasShopping && !hasSeason) return null

  const nowMonth = new Date().getMonth() + 1

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[12px] font-bold text-gray-700">
        📊 {t('supplier.demandTitle', { defaultValue: '수요 신호 (네이버 데이터랩)' })}
      </p>
      {hasShopping && shopping && (
        <p className={`text-[12px] font-semibold mt-1.5 ${shopping.trend === 'up' ? 'text-emerald-700' : shopping.trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
          {shopping.trend === 'up' && t('supplier.demandUp', { defaultValue: '🔺 쇼핑 클릭 수요 상승 중 (최근 2개월 +{{pct}}%)', pct: shopping.changePct })}
          {shopping.trend === 'down' && t('supplier.demandDown', { defaultValue: '🔻 쇼핑 클릭 수요 하락 중 (최근 2개월 {{pct}}%)', pct: shopping.changePct })}
          {shopping.trend === 'flat' && t('supplier.demandFlat', { defaultValue: '─ 쇼핑 클릭 수요 보합 (최근 6개월 큰 변화 없음)' })}
        </p>
      )}
      {hasSeason && season && (
        <p className="text-[12px] font-semibold text-amber-700 mt-1">
          🗓️ {seasonLabel(season.peakMonths, nowMonth)}
        </p>
      )}
      <p className="text-[10px] text-gray-400 mt-1.5">
        {t('supplier.demandDisclaimer', { defaultValue: '네이버쇼핑 클릭·검색 상대지수 기반 참고 지표예요 — 실제 판매량과 다를 수 있어요.' })}
      </p>
    </div>
  )
}
