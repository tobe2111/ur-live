/**
 * 📊 2026-06-12 (감사 개선 ⑤): 판매사 상품 상세 — 시장 신호 카드.
 *   제조사 등록 폼에 만든 자산(네이버 최저가·수요 추이·시즌성)을 판매사 사입 의사결정에 재사용.
 *   "시중 최저가 N원 vs 내 공급가 M원 → 마진 여력" 이 핵심 — 사입 버튼 누르기 전 확신을 줌.
 *   로그인 판매사 전용 + 키 미설정/실패/데이터 부족 시 카드 자체 숨김(fail-soft, 폼 소음 0).
 *   WT 라이트 고정.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { WT, won } from './wholesale-theme'

interface PriceItem { title: string; lprice: number; mallName: string; link: string }
interface Signal {
  configured?: boolean
  lowest?: number | null
  items?: PriceItem[]
  shopping?: { trend: 'up' | 'down' | 'flat'; changePct: number } | null
  season?: { peakMonths: number[]; isSeasonal: boolean } | null
}

let _configured: boolean | null = null
const sellerAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

export default function MarketSignalCard({ name, category, distributorPrice }: {
  name: string
  category: string | null
  distributorPrice: number | null
}) {
  const [signal, setSignal] = useState<Signal | null>(null)
  const [hidden, setHidden] = useState(_configured === false)

  useEffect(() => {
    if (_configured === false || !name || name.length < 4) return
    let alive = true
    api.get(`/api/wholesale/market-signal?q=${encodeURIComponent(name)}&category=${encodeURIComponent(category || '')}`, sellerAuth())
      .then(r => {
        if (!alive) return
        if (r.data?.configured === false) { _configured = false; setHidden(true); return }
        if (r.data?.success) { _configured = true; setSignal(r.data) }
      })
      .catch(() => { /* fail-soft — 카드 숨김 유지 */ })
    return () => { alive = false }
  }, [name, category])

  if (hidden || !signal) return null
  const lowest = typeof signal.lowest === 'number' ? signal.lowest : null
  const shopping = signal.shopping
  const season = signal.season?.isSeasonal ? signal.season : null
  if (lowest === null && !shopping && !season) return null

  const nowMonth = new Date().getMonth() + 1
  const marginVsMarket = lowest !== null && distributorPrice !== null ? lowest - distributorPrice : null

  return (
    <div className="mt-3 rounded-2xl p-4" style={{ background: '#fff', border: `1px solid ${WT.line}` }}>
      <p className="text-[13px] font-extrabold mb-2" style={{ color: WT.ink }}>📊 시장 신호 <span className="font-medium text-[11px]" style={{ color: WT.ink4 }}>네이버쇼핑 기반 참고</span></p>

      {lowest !== null && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12.5px]" style={{ color: WT.ink3 }}>시중 최저가</span>
          <span className="text-[15px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(lowest)}</span>
        </div>
      )}
      {marginVsMarket !== null && (
        <p className="text-[12px] font-bold mt-1" style={{ color: marginVsMarket > 0 ? WT.pos : '#B3253B' }}>
          {marginVsMarket > 0
            ? `내 공급가 대비 시장 마진 여력 +${won(marginVsMarket)} / 개`
            : '⚠️ 시중 최저가가 내 공급가보다 낮아요 — 판매가 책정에 주의'}
        </p>
      )}

      {shopping && (
        <p className={`text-[12px] font-semibold mt-2 ${shopping.trend === 'up' ? '' : ''}`}
          style={{ color: shopping.trend === 'up' ? WT.pos : shopping.trend === 'down' ? '#B3253B' : WT.ink3 }}>
          {shopping.trend === 'up' && `🔺 쇼핑 클릭 수요 상승 중 (최근 2개월 +${shopping.changePct}%)`}
          {shopping.trend === 'down' && `🔻 쇼핑 클릭 수요 하락 중 (최근 2개월 ${shopping.changePct}%)`}
          {shopping.trend === 'flat' && '─ 쇼핑 클릭 수요 보합'}
        </p>
      )}
      {season && season.peakMonths.length > 0 && (
        <p className="text-[12px] font-semibold mt-1" style={{ color: '#9A6B00' }}>
          🗓️ 성수기: {season.peakMonths.map(m => `${m}월`).join('·')}{season.peakMonths.includes(nowMonth) ? ' — 지금이 성수기예요 🔥' : ''}
        </p>
      )}

      {(signal.items?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-0.5">
          {signal.items!.map((item, i) => (
            <li key={i} className="text-[11px] truncate" style={{ color: WT.ink3 }}>
              <a href={item.link} target="_blank" rel="noreferrer" className="hover:underline">
                {won(item.lprice)} · {item.mallName || '판매처'} — {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] mt-2" style={{ color: WT.ink4 }}>상품명 검색 결과라 동일 상품이 아닐 수 있어요. 클릭·검색 상대지수 기반 참고 지표입니다.</p>
    </div>
  )
}
