/**
 * 🎉 우리 동네 새 가게 — 신규 개업 매장 공개 피드 (2026-07-27 대표 "모두 진행" 승인).
 *   공공 인허가 데이터의 개업 감지분을 소비자에게 — 동네에 뭐가 새로 생겼는지 한눈에.
 *   화이트 테마(+dark variant) · 지역 칩 필터 · 연락처 미노출(상호·업종·주소·개업일만).
 */
import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import BrandLoader from '@/components/brand/BrandLoader'

interface Opening { biz_name: string; category: string | null; uptae: string | null; region: string | null; addr_road: string | null; apv_perm_ymd: string | null }
interface Resp { success: boolean; days: number; openings: Opening[]; regions: Array<{ k: string; n: number }> }

const fmtYmd = (y: string | null) => y && y.length === 8 ? `${y.slice(4, 6)}.${y.slice(6, 8)}` : ''
const dDay = (ymd: string | null): string => {
  if (!ymd || ymd.length !== 8) return ''
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8))
  const n = Math.max(0, Math.floor((Date.now() - t) / 86400_000))
  return n <= 1 ? 'NEW' : `D+${n}`
}
const CAT_EMOJI: Record<string, string> = {
  '일반음식점': '🍽️', '휴게음식점': '☕', '미용업': '💇', '숙박업': '🏨', '병원': '🏥', '학원': '🎓',
  '약국': '💊', '동물병원': '🐾', '이용업': '💈', '목욕장업': '🧖', '체력단련장': '💪', '노래연습장': '🎤',
}

export default function NewOpeningsPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const p = new URLSearchParams({ days: '30', limit: '90' })
    if (region) p.set('region', region)
    api.get(`/api/public/new-openings?${p.toString()}`)
      .then(r => { if (alive && r.data?.success) setData(r.data) })
      .catch(() => { /* 빈 상태로 폴백 */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [region])

  const regions = useMemo(() => data?.regions || [], [data])

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A]">
      <SEO title={CONSUMER_SURFACE_SEO['/new-openings'].title} description={CONSUMER_SURFACE_SEO['/new-openings'].description} url="/new-openings" />
      <div className="ur-content-wide px-4 lg:px-8 py-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">🎉 우리 동네 새 가게</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">최근 30일 신규 개업 — 공공 인허가 데이터 기반이라 매일 자동 갱신됩니다.</p>

        {/* 지역 칩 */}
        {regions.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setRegion('')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${!region ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white' : 'bg-white text-gray-600 border-gray-200 dark:bg-[#121212] dark:text-gray-300 dark:border-[#2A2A2A]'}`}>전체</button>
            {regions.map(r => (
              <button key={r.k} onClick={() => setRegion(prev => prev === r.k ? '' : r.k)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${region === r.k ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white' : 'bg-white text-gray-600 border-gray-200 dark:bg-[#121212] dark:text-gray-300 dark:border-[#2A2A2A]'}`}>
                {r.k} {r.n}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center"><BrandLoader /></div>
        ) : !data || data.openings.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">이 지역의 최근 개업 소식이 아직 없어요.</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.openings.map((o, i) => (
              <div key={i} className="rounded-xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {CAT_EMOJI[o.category || ''] || '🏪'} {o.biz_name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{[o.region, o.uptae || o.category].filter(Boolean).join(' · ')}</div>
                    {o.addr_road && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 truncate">{o.addr_road}</div>}
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold ${dDay(o.apv_perm_ymd) === 'NEW' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-gray-100 text-gray-500 dark:bg-[#1A1A1A] dark:text-gray-400'}`}
                    title={`인허가일 기준${o.apv_perm_ymd ? ` (${fmtYmd(o.apv_perm_ymd)})` : ''}`}>
                    {dDay(o.apv_perm_ymd) || '개업'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-[11px] text-gray-400 dark:text-gray-500">출처: 지방행정 인허가 공공데이터 — 상호·업종·주소 등 공개 정보만 표시합니다.</p>
      </div>
    </div>
  )
}
