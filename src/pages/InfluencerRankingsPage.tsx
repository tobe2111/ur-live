/**
 * 🛡️ 2026-05-16: 인플루언서 지역 ranking 공개 페이지.
 *
 * 누구나 조회 가능. 인플이 본인 ranking 캡쳐 → SNS 공유 = 자연 마케팅.
 * 익명화: 인플이 본인 settlement 페이지에서 ranking_public OFF 가능.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Trophy, Award } from 'lucide-react'

interface Ranked {
  rank: number
  influencer_id: string | null
  display_name: string
  attribution_count: number
  total_commission: number
  seller_count: number
  product_count: number
}

const REGIONS = [
  { key: 'all', label: '전국' },
  { key: 'seoul', label: '서울' },
  { key: 'gangnam', label: '강남구' },
  { key: 'seocho', label: '서초구' },
  { key: 'mapo', label: '마포구' },
  { key: 'songpa', label: '송파구' },
  { key: 'jongno', label: '종로구' },
  { key: 'busan', label: '부산' },
  { key: 'incheon', label: '인천' },
  { key: 'daegu', label: '대구' },
  { key: 'gyeonggi', label: '경기' },
] as const

export default function InfluencerRankingsPage() {
  const [list, setList] = useState<Ranked[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('all')
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const [metric, setMetric] = useState<'commission' | 'count'>('commission')

  useEffect(() => {
    setLoading(true)
    api.get('/api/influencer-rankings', { params: { region, period, metric } })
      .then((r) => { if (r.data?.success) setList(r.data.data || []) })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [region, period, metric])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="인플루언서 랭킹 - 유어딜" description="지역별 매출 Top 인플루언서 — 실시간 ranking" url="/influencer/rankings" />

      <header className="sticky top-0 z-30 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6" />
          <h1 className="text-lg font-extrabold">인플루언서 랭킹</h1>
        </div>
        <p className="text-[11px] opacity-90 mt-1">지역별 매출 Top — 매월 1일 리셋</p>
      </header>

      <main className="ur-content-narrow mx-auto px-4 py-4 space-y-4">
        {/* 지역 탭 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {REGIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRegion(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                region === r.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* 기간 / 기준 */}
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'all')}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="month">이번 달</option>
            <option value="all">누적</option>
          </select>
          <select value={metric} onChange={(e) => setMetric(e.target.value as 'commission' | 'count')}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="commission">매출 commission</option>
            <option value="count">referral 건수</option>
          </select>
        </div>

        {/* 랭킹 리스트 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-10">로딩 중...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">아직 랭킹 데이터가 없습니다</p>
          ) : (
            <ul>
              {list.map((r) => {
                const isTop3 = r.rank <= 3
                const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null
                return (
                  <li key={r.rank} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${isTop3 ? 'bg-amber-50' : ''}`}>
                    <span className={`w-8 text-center font-extrabold ${isTop3 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {medal || r.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{r.display_name}</p>
                      <p className="text-[10px] text-gray-500">{r.seller_count}개 매장 · {r.attribution_count}건</p>
                    </div>
                    <div className="text-right">
                      {metric === 'commission' ? (
                        <p className="text-sm font-extrabold text-pink-600">{r.total_commission.toLocaleString()}원</p>
                      ) : (
                        <p className="text-sm font-extrabold text-blue-600">{r.attribution_count}건</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-gray-400 text-center pt-2">
          📢 본인 ID 노출 원치 않으면 <a href="/influencer/settlement" className="underline">정산 설정</a> 에서 비공개 가능
        </p>
      </main>
    </div>
  )
}
