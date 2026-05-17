/**
 * 🛡️ 2026-05-16: 매장 매출 실시간 대시보드 (/seller/realtime).
 *
 * 오늘 / 7일 / 30일 매출 + voucher 사용률 + 인플 referral 비중 + 최근 사용 voucher.
 * 60초 자동 새로고침.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { getSellerToken } from '@/lib/seller-auth'
import { TrendingUp, Ticket, Users, RefreshCw } from 'lucide-react'
import { formatNumber, safeNum } from '@/utils/format'

interface RealtimeStats {
  today: { cnt: number; amt: number }
  week: { cnt: number; amt: number }
  month: { cnt: number; amt: number }
  voucher_stats: { total: number; used: number; expired: number; unused: number }
  referral_stats: { cnt: number; total_commission: number }
  recent_uses: Array<{ id: number; code: string; used_at: string; product_name: string; applied_price: number }>
  daily: Array<{ d: string; cnt: number; amt: number }>
}

export default function SellerRealtimeDashboardPage() {
  const [data, setData] = useState<RealtimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const headers = { Authorization: `Bearer ${getSellerToken() || ''}` }

  function load() {
    setLoading(true)
    api.get('/api/seller-marketing/realtime-stats', { headers })
      .then((r) => { if (r.data?.success) setData(r.data.data) })
      .catch(() => toast.error('로드 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  if (loading && !data) return <SellerLayout title="실시간 대시보드"><div className="p-6"><p className="text-gray-500">로딩 중...</p></div></SellerLayout>
  if (!data) return null

  // 🛡️ 2026-05-17: safeNum 으로 NaN 방어 — 데이터 누락 시 0%, 0건 표시
  const totalVouchers = safeNum(data.voucher_stats?.total)
  const usedVouchers = safeNum(data.voucher_stats?.used)
  const useRate = totalVouchers > 0
    ? Math.round((usedVouchers / totalVouchers) * 100)
    : 0
  const maxDaily = Math.max(...(data.daily || []).map(d => safeNum(d.amt)), 1)

  return (
    <SellerLayout title="실시간 매출 대시보드">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-500" /> 실시간 매출
            </h2>
            <p className="text-xs text-gray-500 mt-1">60초마다 자동 새로고침</p>
          </div>
          <button onClick={load} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>

        {/* 3 카드: 오늘 / 7일 / 30일 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-pink-50 rounded-xl p-4 text-center">
            <p className="text-[10px] text-pink-700 font-medium">오늘</p>
            <p className="text-2xl font-extrabold text-pink-800 mt-1">{formatNumber(data.today?.amt)}원</p>
            <p className="text-[10px] text-pink-600 mt-1">{safeNum(data.today?.cnt)}건</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-[10px] text-blue-700 font-medium">최근 7일</p>
            <p className="text-2xl font-extrabold text-blue-800 mt-1">{formatNumber(data.week?.amt)}원</p>
            <p className="text-[10px] text-blue-600 mt-1">{safeNum(data.week?.cnt)}건</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-[10px] text-emerald-700 font-medium">최근 30일</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{formatNumber(data.month?.amt)}원</p>
            <p className="text-[10px] text-emerald-600 mt-1">{safeNum(data.month?.cnt)}건</p>
          </div>
        </div>

        {/* voucher 사용률 + 인플 referral */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Ticket className="w-4 h-4 text-amber-500" /> Voucher 사용률 (30일)</h3>
            <p className="text-3xl font-extrabold text-gray-900">{useRate}%</p>
            <p className="text-[11px] text-gray-500 mt-1">{data.voucher_stats.used} / {data.voucher_stats.total}</p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${useRate}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">미사용 {data.voucher_stats.unused} · 만료 {data.voucher_stats.expired}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Users className="w-4 h-4 text-pink-500" /> 인플 Referral 매출 (30일)</h3>
            <p className="text-3xl font-extrabold text-gray-900">{safeNum(data.referral_stats?.cnt)}건</p>
            <p className="text-[11px] text-gray-500 mt-1">인플에 지급된 commission: {formatNumber(data.referral_stats?.total_commission)}원</p>
          </div>
        </div>

        {/* 일별 추세 (지난 14일) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">일별 매출 (지난 14일)</h3>
          {data.daily.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">데이터 없음</p>
          ) : (
            <div className="space-y-1">
              {data.daily.map(d => (
                <div key={d.d} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16 font-mono">{d.d.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                    <div className="bg-pink-400 h-full" style={{ width: `${(safeNum(d.amt) / maxDaily) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-700 w-24 text-right font-bold">{formatNumber(d.amt)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 사용 voucher 10개 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">최근 사용된 voucher (10건)</h3>
          {data.recent_uses.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">아직 사용된 voucher 가 없습니다</p>
          ) : (
            <ul className="space-y-1.5">
              {data.recent_uses.map(v => (
                <li key={v.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-gray-900 truncate flex-1">{v.product_name}</span>
                  <span className="text-gray-500 font-mono text-[10px] mx-2">{v.code}</span>
                  <span className="text-gray-400 text-[10px]">{v.used_at ? new Date(v.used_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}
