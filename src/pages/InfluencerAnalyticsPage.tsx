/**
 * 🛡️ 2026-05-16: 인플루언서 성과표 (/influencer/analytics).
 *
 * 본인 referral 매출 / 매장별 ranking / 상품별 ranking / 일별 추세.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { TrendingUp, Award, Clock, ChevronLeft, BarChart3 } from 'lucide-react'

interface Analytics {
  summary: {
    total_attributions: number
    pending: number
    available: number
    paid: number
    clawed_back: number
    total: number
  }
  top_sellers: Array<{ seller_id: number; seller_name: string | null; attribution_count: number; total_commission: number }>
  top_products: Array<{ product_id: number; product_name: string | null; restaurant_name: string | null; attribution_count: number; total_commission: number }>
  daily: Array<{ d: string; cnt: number; amt: number }>
}

export default function InfluencerAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/influencer-settlement/analytics')
      .then((r) => { if (r.data?.success) setData(r.data.data) })
      .catch(() => toast.error('로드 실패'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-sm text-gray-500">로딩 중...</p></div>
  if (!data) return null

  const maxDaily = Math.max(...data.daily.map(d => d.amt), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="인플루언서 성과표 - 유어딜" description="referral 매출 / 매장별 ranking / 일별 추세" url="/influencer/analytics" />
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3 flex items-center gap-2">
        <Link to="/influencer/settlement" className="text-gray-700"><ChevronLeft className="w-5 h-5" /></Link>
        <BarChart3 className="w-5 h-5 text-pink-500" />
        <h1 className="text-base font-bold text-gray-900 flex-1">성과표</h1>
      </header>

      <main className="ur-content-narrow mx-auto px-4 py-4 space-y-5">
        {/* 총 commission 5계정 split */}
        <div className="bg-white border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pink-500" /> 총 commission ({data.summary.total_attributions}건)
          </h3>
          <p className="text-2xl font-extrabold text-gray-900">{data.summary.total.toLocaleString()}원</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-yellow-50 rounded p-2">
              <p className="text-yellow-700 font-medium">대기 (환불기간)</p>
              <p className="text-sm font-bold text-yellow-900">{data.summary.pending.toLocaleString()}원</p>
            </div>
            <div className="bg-blue-50 rounded p-2">
              <p className="text-blue-700 font-medium">송금 가능</p>
              <p className="text-sm font-bold text-blue-900">{data.summary.available.toLocaleString()}원</p>
            </div>
            <div className="bg-emerald-50 rounded p-2">
              <p className="text-emerald-700 font-medium">지급 완료</p>
              <p className="text-sm font-bold text-emerald-900">{data.summary.paid.toLocaleString()}원</p>
            </div>
            <div className="bg-red-50 rounded p-2">
              <p className="text-red-700 font-medium">회수됨 (환불)</p>
              <p className="text-sm font-bold text-red-900">{data.summary.clawed_back.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        {/* 일별 추세 (지난 30일) — 간단 가로 막대 */}
        <div className="bg-white border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> 일별 추세 (지난 30일)
          </h3>
          {data.daily.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">데이터 없음</p>
          ) : (
            <div className="space-y-1">
              {data.daily.slice(0, 14).map(d => (
                <div key={d.d} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16 font-mono">{d.d.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                    <div className="bg-pink-400 h-full" style={{ width: `${(d.amt / maxDaily) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-700 w-20 text-right font-bold">{d.amt.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 매장별 TOP 10 */}
        <div className="bg-white border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> 매장별 Top 10
          </h3>
          {data.top_sellers.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">아직 commission 없음</p>
          ) : (
            <ol className="space-y-1.5">
              {data.top_sellers.map((s, i) => (
                <li key={s.seller_id} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center font-bold text-gray-500">{i + 1}</span>
                  <span className="flex-1 truncate text-gray-900">{s.seller_name || `매장 ${s.seller_id}`}</span>
                  <span className="text-gray-500 font-mono text-[10px]">{s.attribution_count}건</span>
                  <span className="font-bold text-pink-600 w-20 text-right">{s.total_commission.toLocaleString()}원</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 상품별 TOP 10 */}
        <div className="bg-white border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">상품별 Top 10</h3>
          {data.top_products.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">데이터 없음</p>
          ) : (
            <ol className="space-y-1.5">
              {data.top_products.map((p, i) => (
                <li key={p.product_id} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center font-bold text-gray-500">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-gray-900">{p.product_name || '-'}</p>
                    {p.restaurant_name && <p className="truncate text-gray-400 text-[10px]">{p.restaurant_name}</p>}
                  </div>
                  <span className="text-gray-500 font-mono text-[10px]">{p.attribution_count}건</span>
                  <span className="font-bold text-pink-600 w-20 text-right">{p.total_commission.toLocaleString()}원</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  )
}
