/**
 * 🛡️ 2026-05-18: 사용자 숙소 검색/목록 (PR 3/6).
 *
 * 필터: 지역 / 체크인-체크아웃 / 인원 / 가격대 / 숙소 타입 / 정렬
 * 다크 테마 (사용자 메인) — bg-[#020202] / text-white.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Search, MapPin, Calendar, Users, Star, SlidersHorizontal, X } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface StaySearchItem {
  id: number
  name: string
  image_url?: string
  property_type?: string
  star_rating?: number | null
  region_sido?: string
  region_sigungu?: string
  amenities?: string | null
  price_from?: number | null
  max_guests?: number | null
  avg_rating?: number | null
  review_count?: number
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: '호텔', motel: '모텔', pension: '펜션', guesthouse: '게스트하우스',
  resort: '리조트', glamping: '글램핑', house: '주택',
}

function todayIso() { return new Date().toISOString().slice(0, 10) }
function tomorrowIso() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10) }

export default function StaysSearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<StaySearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    region: params.get('region') || '',
    check_in: params.get('check_in') || todayIso(),
    check_out: params.get('check_out') || tomorrowIso(),
    guests: Number(params.get('guests')) || 2,
    property_type: params.get('property_type') || '',
    // 🛡️ 2026-05-18: 판매 모드 필터 — 'date' (날짜 지정) / 'voucher' (기간 무관) / '' (전체).
    sale_mode: params.get('sale_mode') || '',
    min_price: Number(params.get('min_price')) || 0,
    max_price: Number(params.get('max_price')) || 0,
    sort: params.get('sort') || 'recent',
  })

  useEffect(() => { load() }, [filters.check_in, filters.check_out, filters.guests, filters.sort]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== '' && v !== 0) qs.set(k, String(v))
      })
      const res = await api.get(`/api/group-buy/stays/search?${qs.toString()}`)
      if (res.data?.success) setItems(res.data.data || [])
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  function apply() {
    const next = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== 0) next.set(k, String(v)) })
    setParams(next)
    setShowFilters(false)
    load()
  }

  const nights = Math.max(1, Math.round((new Date(filters.check_out).getTime() - new Date(filters.check_in).getTime()) / 86400000))

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-safe-nav">
      <SEO title="숙소 공구 - 유어딜" description="펜션 호텔 모텔 등 매장 공구권 — 최대 70% 할인" url="/stays" />

      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3">
          <Link to="/" className="text-sm font-bold">←</Link>
          <h1 className="text-base font-bold flex-1">🏨 숙소 공구</h1>
          <button
            onClick={() => setShowFilters(true)}
            className="p-2 rounded-lg hover:bg-white/[0.06]"
            aria-label="필터"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Quick filters bar */}
        <div className="ur-content-wide px-4 lg:px-8 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setShowFilters(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] rounded-full text-xs whitespace-nowrap">
            <Calendar className="w-3 h-3" /> {filters.check_in.slice(5)} - {filters.check_out.slice(5)} ({nights}박)
          </button>
          <button onClick={() => setShowFilters(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] rounded-full text-xs whitespace-nowrap">
            <Users className="w-3 h-3" /> 성인 {filters.guests}명
          </button>
          {filters.region && (
            <button onClick={() => setFilters({ ...filters, region: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-xs whitespace-nowrap">
              <MapPin className="w-3 h-3" /> {filters.region} ×
            </button>
          )}
          {filters.property_type && (
            <button onClick={() => setFilters({ ...filters, property_type: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-xs whitespace-nowrap">
              {PROPERTY_TYPE_LABELS[filters.property_type]} ×
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="ur-content-wide px-4 lg:px-8 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">검색 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((s) => {
              const amenitiesArr: string[] = (() => {
                if (!s.amenities) return []
                try { return JSON.parse(s.amenities) } catch { return [] }
              })()
              return (
                <Link
                  key={s.id}
                  to={`/stays/${s.id}?check_in=${filters.check_in}&check_out=${filters.check_out}&guests=${filters.guests}`}
                  className="bg-[#121212] rounded-xl overflow-hidden border border-[#1A1A1A] hover:border-[#2A2A2A] transition-all"
                >
                  <div className="relative aspect-[4/3] bg-[#1A1A1A]">
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : null}
                    {s.property_type && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-semibold">
                        {PROPERTY_TYPE_LABELS[s.property_type] || s.property_type}
                      </div>
                    )}
                    {s.star_rating ? (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/80 rounded text-[10px] font-bold">
                        {Array.from({ length: s.star_rating }).map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-white" />)}
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold line-clamp-1">{s.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{[s.region_sido, s.region_sigungu].filter(Boolean).join(' ')}</span>
                    </div>
                    {s.avg_rating ? (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold">{s.avg_rating.toFixed(1)}</span>
                        <span className="text-[10px] text-gray-500">({s.review_count})</span>
                      </div>
                    ) : null}
                    {amenitiesArr.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {amenitiesArr.slice(0, 3).map((a) => (
                          <span key={a} className="text-[9px] text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                            {a === 'wifi' ? '와이파이' : a === 'parking' ? '주차' : a === 'pool' ? '수영장' : a === 'breakfast' ? '조식' : a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-[#1A1A1A]">
                      {s.price_from ? (
                        <p className="text-sm font-extrabold text-pink-400">
                          ₩{formatNumber(s.price_from)}
                          <span className="text-[10px] text-gray-500 font-normal ml-1">/박~</span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">가격 미공개</p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters Modal */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShowFilters(false)}
          role="presentation"
        >
          <div className="bg-[#0A0A0A] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-[#1A1A1A] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0A0A0A] flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]">
              <h3 className="text-base font-bold">검색 필터</h3>
              <button onClick={() => setShowFilters(false)} aria-label="닫기" className="p-1.5 rounded hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">지역</label>
                <input
                  type="text"
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  placeholder="서울 / 제주 / 부산 등"
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">체크인</label>
                  <input type="date" value={filters.check_in} onChange={(e) => setFilters({ ...filters, check_in: e.target.value })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">체크아웃</label>
                  <input type="date" value={filters.check_out} onChange={(e) => setFilters({ ...filters, check_out: e.target.value })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">인원</label>
                <input type="number" min={1} max={20} value={filters.guests} onChange={(e) => setFilters({ ...filters, guests: Number(e.target.value) || 1 })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">숙소 타입</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                    <button key={v} onClick={() => setFilters({ ...filters, property_type: filters.property_type === v ? '' : v })}
                      className={`p-2 rounded-lg text-[11px] font-semibold ${filters.property_type === v ? 'bg-blue-600 text-white' : 'bg-[#1A1A1A] text-gray-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">판매 방식</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { v: '', l: '전체' },
                    { v: 'date', l: '📅 날짜 지정' },
                    { v: 'voucher', l: '🎫 숙소권' },
                  ].map((m) => (
                    <button key={m.v} type="button"
                      onClick={() => setFilters({ ...filters, sale_mode: m.v })}
                      className={`p-2 rounded-lg text-[11px] font-semibold ${filters.sale_mode === m.v ? 'bg-pink-500 text-white' : 'bg-[#1A1A1A] text-gray-300'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">정렬</label>
                <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm">
                  <option value="recent">최신 등록</option>
                  <option value="price_asc">가격 낮은순</option>
                  <option value="price_desc">가격 높은순</option>
                  <option value="rating">평점 높은순</option>
                </select>
              </div>
              <button onClick={apply} className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">검색</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
