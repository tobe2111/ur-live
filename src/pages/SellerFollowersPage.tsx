/**
 * 🛡️ 2026-05-15: 셀러 단골 분석 페이지.
 *
 * URL: /seller/followers
 *
 * 표시:
 *   - 총 단골 수
 *   - 알림 종류별 ON 비율 (라이브 / 공구 / 신상품)
 *   - 일별 신규 단골 30일 차트 (bar)
 *   - 최근 단골 10명 (마스킹)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Bell, TrendingUp, Loader2, Megaphone } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatNumber } from '@/utils/format'

interface Analytics {
  total: number
  notify_on: { live_start: number; group_buy: number; new_product: number }
  daily: Array<{ day: string; new_count: number }>
  recent_followers: Array<{ user_id: string; masked_name: string; avatar: string | null; created_at: string }>
}

export default function SellerFollowersPage() {
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${getSellerToken()}` }
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    api.get('/api/seller-public/seller/analytics', { headers })
      .then(r => { if (r.data?.success) setData(r.data.data) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <SellerLayout title="단골 분석"><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div></SellerLayout>
  }
  if (!data) {
    return <SellerLayout title="단골 분석"><div className="p-8 text-center text-gray-500">데이터 로드 실패</div></SellerLayout>
  }

  const maxDaily = Math.max(1, ...data.daily.map(d => d.new_count))
  const pct = (n: number) => data.total > 0 ? Math.round((n / data.total) * 100) : 0
  const last7Days = data.daily.slice(0, 7).reduce((sum, d) => sum + d.new_count, 0)

  return (
    <SellerLayout title="단골 분석">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="단골 분석"
          subtitle="내 단골 수 + 알림 ON 비율 + 신규 추이"
          icon={<Users className="h-5 w-5" />}
        />

        {/* 총합 카드 */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs opacity-80 font-bold">총 단골</p>
              <p className="text-3xl font-extrabold mt-1">{formatNumber(data.total)}<span className="text-base font-bold ml-1">명</span></p>
            </div>
            <Users className="w-10 h-10 opacity-50" />
          </div>
          <div className="border-t border-white/20 pt-3 text-xs">
            <p className="opacity-80">최근 7일 신규 <b className="text-sm">{last7Days}</b>명</p>
          </div>
        </div>

        {/* 알림 ON 비율 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
            <Bell className="w-4 h-4 text-pink-500" /> 알림 ON 비율
          </p>
          {data.total === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">단골 없음</p>
          ) : (
            <div className="space-y-3">
              {([
                { key: 'live_start', label: '📺 라이브 시작', value: data.notify_on.live_start },
                { key: 'group_buy', label: '🔥 공구 시작', value: data.notify_on.group_buy },
                { key: 'new_product', label: '🎁 신상품', value: data.notify_on.new_product },
              ]).map(item => (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-bold text-gray-900">{item.value}명 ({pct(item.value)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" style={{ width: `${pct(item.value)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 일별 신규 단골 (30일) */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-pink-500" /> 최근 30일 신규 단골
          </p>
          {data.daily.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">데이터 없음 — 첫 단골을 기다리는 중</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-24">
                {data.daily.slice(0, 30).reverse().map((d, i) => {
                  const h = Math.max(2, (d.new_count / maxDaily) * 96)
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-pink-500 to-rose-400 rounded-t hover:from-pink-600 hover:to-rose-500 transition-colors cursor-pointer"
                      style={{ height: h }}
                      title={`${d.day}: ${d.new_count}명`}
                    />
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>{data.daily[Math.min(29, data.daily.length - 1)]?.day || ''}</span>
                <span>최대 {maxDaily}명/일</span>
                <span>{data.daily[0]?.day || ''}</span>
              </div>
            </>
          )}
        </div>

        {/* 최근 단골 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">최근 단골 등록자</p>
          </div>
          {data.recent_followers.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">아직 단골 없음</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recent_followers.map((f, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  {f.avatar ? (
                    <img src={f.avatar} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-rose-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900">{f.masked_name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{new Date(f.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/seller/notify-followers')}
            className="py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Megaphone className="w-4 h-4" /> 단골에게 알림
          </button>
          <button
            onClick={() => navigate('/seller/promo-codes')}
            className="py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold"
          >
            할인 코드 →
          </button>
        </div>
      </div>
    </SellerLayout>
  )
}
