/**
 * 광고 슬롯 관리 페이지 (2026-05-05)
 *
 * migration 0244 (ad_slots, ad_bids) 기반.
 * 어드민이 슬롯 상태 확인 + 낙찰 이력 + 수동 종료/초기화를 수행합니다.
 */

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Megaphone, Trophy, Clock, TrendingUp, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface AdSlot {
  slot_id: string
  display_name: string
  description: string
  base_price: number
  current_seller_id: number | null
  current_bid: number | null
  expires_at: string | null
  starts_at: string | null
  is_active: number
  current_winner_name: string | null
  top_bid: number | null
  bid_count: number
}

interface AdBid {
  id: number
  slot_id: string
  slot_name: string
  seller_id: number
  seller_name: string
  bid_amount: number
  status: string
  payment_status: string
  created_at: string
  start_period: string | null
  end_period: string | null
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return '-'
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '만료'
  const h = Math.floor(diff / 3600_000)
  const m = Math.floor((diff % 3600_000) / 60_000)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: '입찰중', cls: 'bg-blue-100 text-blue-700' },
  won:       { label: '낙찰',   cls: 'bg-green-100 text-green-700' },
  lost:      { label: '탈락',   cls: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '취소',   cls: 'bg-gray-100 text-gray-500' },
  refunded:  { label: '환불',   cls: 'bg-amber-100 text-amber-700' },
}

export default function AdminAdSlotsPage() {
  const [slots, setSlots] = useState<AdSlot[]>([])
  const [bids, setBids] = useState<AdBid[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'slots' | 'bids'>('slots')
  const token = localStorage.getItem('admin_token') || ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [slotsRes, bidsRes] = await Promise.all([
        api.get('/api/admin/ad-slots', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/api/admin/ad-slots/bids', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      setSlots(slotsRes.data?.slots ?? [])
      setBids(bidsRes.data?.bids ?? [])
    } catch {
      toast.error('광고 슬롯 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const activeCount = slots.filter(s => s.current_seller_id).length
  const totalBids = bids.filter(b => b.status === 'active').length

  return (
    <AdminLayout title="광고 슬롯 관리">
      <DashboardPageHeader
        title="광고 슬롯 입찰 관리"
        subtitle="매일 18시 자동 낙찰. 5개 슬롯의 현황과 입찰 이력을 확인합니다."
        icon={<Megaphone className="w-5 h-5" />}
        actions={
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[12px] text-gray-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />새로고침
          </button>
        }
      />

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
        {[
          { label: '전체 슬롯', value: slots.length, icon: <Megaphone className="w-4 h-4 text-gray-400" /> },
          { label: '현재 노출 중', value: activeCount, icon: <Trophy className="w-4 h-4 text-green-500" /> },
          { label: '활성 입찰', value: totalBids, icon: <TrendingUp className="w-4 h-4 text-blue-500" /> },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">{c.icon}<p className="text-[11px] text-gray-500">{c.label}</p></div>
            <p className="text-[22px] font-black text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {(['slots', 'bids'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'slots' ? '슬롯 현황' : '입찰 이력'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />)}
        </div>
      ) : tab === 'slots' ? (
        <div className="space-y-3">
          {slots.map(slot => (
            <div key={slot.slot_id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold text-gray-900">{slot.display_name}</p>
                  <p className="text-[11px] text-gray-500">{slot.description}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  slot.current_seller_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {slot.current_seller_id ? '노출 중' : '대기'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                <div>
                  <p className="text-[10px] text-gray-400">기본가</p>
                  <p className="text-[12px] font-semibold text-gray-900">{slot.base_price.toLocaleString('ko-KR')}원</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">현재 최고가</p>
                  <p className="text-[12px] font-semibold text-gray-900">
                    {slot.top_bid ? `${slot.top_bid.toLocaleString('ko-KR')}원` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">입찰 수</p>
                  <p className="text-[12px] font-semibold text-gray-900">{slot.bid_count}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><Clock className="w-2.5 h-2.5" />마감까지</p>
                  <p className="text-[12px] font-semibold text-gray-900">{timeLeft(slot.expires_at)}</p>
                </div>
              </div>
              {slot.current_winner_name && (
                <p className="text-[11px] text-gray-500 mt-2">낙찰자: {slot.current_winner_name}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">슬롯</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">셀러</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">입찰가</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">결제</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">입찰 시각</th>
                </tr>
              </thead>
              <tbody>
                {bids.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-[12px]">입찰 이력이 없습니다.</td></tr>
                ) : bids.map(b => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-[12px] text-gray-700">{b.slot_name}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-900 font-medium">{b.seller_name}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-900">{b.bid_amount.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${(STATUS_LABEL[b.status] ?? STATUS_LABEL.lost).cls}`}>
                        {(STATUS_LABEL[b.status] ?? STATUS_LABEL.lost).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{b.payment_status}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
