/**
 * 🛒 2026-06-12 (사용자 요청): 네이버쇼핑 최저가 대조 — 상품 등록/가격수정 폼.
 *   상품명 입력(800ms 디바운스) → 시중 최저가 top3 표시 + 공급가/권장가 비교 경고:
 *     · 공급가 ≥ 최저가 → 빨강 (판매사가 마진을 낼 수 없음 — 핵심 견제 신호)
 *     · 권장가 > 최저가 → 주의 (권장 소비자가가 시장가보다 높음)
 *     · 공급가 < 최저가 → 초록 (경쟁력 있는 공급가)
 *   서버 키 미설정(configured:false)이면 통째로 숨김 — 폼 소음 0. 검색 결과는 동일 상품이
 *   아닐 수 있으므로 '참고' 디스클레이머 명시.
 */
import { useState, useEffect, useRef } from 'react'
import { supplierApi } from '@/lib/supplier-api'
import { formatWon } from '@/utils/format'

interface PriceItem { title: string; lprice: number; mallName: string; link: string }
interface CheckRes { success?: boolean; configured?: boolean; lowest?: number | null; items?: PriceItem[] }

// 키 미설정 환경에서 매 키입력 재호출 방지 — 세션 1회 판정.
let _configured: boolean | null = null

export default function NaverPriceCheck({ name, supplyPrice, retailPrice, t }: {
  name: string
  supplyPrice: string | number
  retailPrice: string | number
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const [items, setItems] = useState<PriceItem[]>([])
  const [lowest, setLowest] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(_configured === false)
  const lastQ = useRef('')

  useEffect(() => {
    if (_configured === false) return
    const q = name.trim()
    if (q.length < 4) { setItems([]); setLowest(null); return }
    if (q === lastQ.current) return
    const tm = setTimeout(() => {
      lastQ.current = q
      setLoading(true)
      supplierApi.get<CheckRes>(`/api/supplier/naver-price-check?q=${encodeURIComponent(q)}`)
        .then(r => {
          if (r.configured === false) { _configured = false; setHidden(true); return }
          _configured = true
          setItems((r.items || []).slice(0, 3))
          setLowest(typeof r.lowest === 'number' ? r.lowest : null)
        })
        .catch(() => { /* 조회 실패 — 표시 안 함 (fail-soft) */ })
        .finally(() => setLoading(false))
    }, 800)
    return () => clearTimeout(tm)
  }, [name])

  if (hidden) return null
  if (!loading && lowest === null) return null

  const supply = Number(supplyPrice) || 0
  const retail = Number(retailPrice) || 0

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[12px] font-bold text-gray-700">
        🔎 {t('supplier.naverPriceTitle', { defaultValue: '네이버쇼핑 최저가 (참고)' })}
        {loading && <span className="ml-2 text-[11px] font-normal text-gray-400">{t('common.loading', { defaultValue: '불러오는 중...' })}</span>}
      </p>

      {lowest !== null && (
        <>
          <p className="text-[14px] font-extrabold text-gray-900 mt-1">{formatWon(lowest)}</p>

          {/* 비교 신호 — 공급가 기준이 핵심 */}
          {supply > 0 && supply >= lowest && (
            <p className="text-[11.5px] font-bold text-red-600 mt-1">
              {t('supplier.naverPriceSupplyHigh', { defaultValue: '⚠️ 공급가가 시중 최저가보다 높거나 같아요 — 판매사가 마진을 낼 수 없어 제안이 어려워요.' })}
            </p>
          )}
          {supply > 0 && supply < lowest && (
            <p className="text-[11.5px] font-bold text-emerald-700 mt-1">
              {t('supplier.naverPriceSupplyGood', { defaultValue: '✓ 공급가가 시중 최저가 아래예요 — 유통 마진 여력 {{gap}}.', gap: formatWon(lowest - supply) })}
            </p>
          )}
          {retail > 0 && retail > lowest && (
            <p className="text-[11px] font-semibold text-amber-600 mt-0.5">
              {t('supplier.naverPriceRetailHigh', { defaultValue: '권장 소비자가가 시중 최저가보다 높아요.' })}
            </p>
          )}

          {items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {items.map((item, i) => (
                <li key={i} className="text-[11px] text-gray-500 truncate">
                  <a href={item.link} target="_blank" rel="noreferrer" className="hover:underline">
                    {formatWon(item.lprice)} · {item.mallName || '판매처'} — {item.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-gray-400 mt-2">
            {t('supplier.naverPriceDisclaimer', { defaultValue: '상품명 검색 결과라 동일 상품이 아닐 수 있어요 — 옵션·구성 차이를 확인해주세요.' })}
          </p>
        </>
      )}
    </div>
  )
}
