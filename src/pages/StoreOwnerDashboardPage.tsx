/**
 * 🛡️ 2026-05-21 Phase TD-8: 매장 사장님 종합 매출 페이지.
 *
 * URL: /seller/store-dashboard
 * 대상: seller_type='store_owner' 또는 'both' (RoleGate 자동 분기)
 *
 * 내용:
 *   - 본인 매장 전체 매출 합산 (이번 달 / 누적)
 *   - 사용된 voucher 통계 (status 별)
 *   - QR 스캔 빠른 진입
 *   - 정산 내역 요약
 *   - 인플루언서/에이전시 commission 안내
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import RoleGate from '@/components/RoleGate'
import { Store, ShoppingBag, CheckCircle, XCircle, Wallet } from 'lucide-react'
import { formatWon, formatNumber } from '@/utils/format'

interface StoreStats {
  total_products: number
  active_products: number
  total_vouchers_sold: number
  vouchers_used: number
  vouchers_unused: number
  vouchers_refunded: number
  revenue_total: number
  revenue_this_month: number
  pending_payout: number
}

export default function StoreOwnerDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/seller/login'); return }
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/api/seller/store-dashboard/stats')
      if (res.data?.success) setStats(res.data.data)
    } catch (e) {
      console.error('load store stats', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SellerLayout title="🏪 매장 종합">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          icon={<Store className="h-5 w-5" />}
          title="🏪 매장 종합 매출"
          subtitle="본인 매장 전체 매출 / voucher 사용 현황 / 정산 한 화면"
        />

        <RoleGate showFor="store-or-both" fallback={
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠️ 매장 사장님 전용 페이지입니다. (seller_type=store_owner 또는 both)
          </div>
        }>
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-16">불러오는 중...</p>
          ) : !stats ? (
            <p className="text-center text-sm text-gray-400 py-16">데이터를 불러올 수 없습니다.</p>
          ) : (
            <>
              {/* 4 KPI 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-xs text-gray-500"><ShoppingBag className="w-3.5 h-3.5" /> 총 매출</div>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatWon(stats.revenue_total)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">누적</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-xs text-gray-500">📅 이번 달 매출</div>
                  <p className="text-xl font-bold text-blue-600 mt-1">{formatWon(stats.revenue_this_month)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-xs text-gray-500"><Wallet className="w-3.5 h-3.5" /> 미정산 잔액</div>
                  <p className="text-xl font-bold text-amber-600 mt-1">{formatWon(stats.pending_payout)}</p>
                  <a href="/seller/ledger" className="text-[10px] text-blue-600 underline">상세 →</a>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">활성 상품</div>
                  <p className="text-xl font-bold text-gray-900 mt-1">{stats.active_products}/{stats.total_products}</p>
                </div>
              </div>

              {/* Voucher 통계 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-3">📊 Voucher 사용 현황</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-500">발급</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(stats.total_vouchers_sold)}</div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <div className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> 사용</div>
                    <div className="text-lg font-bold text-emerald-700">{formatNumber(stats.vouchers_used)}</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <div className="text-amber-600">미사용</div>
                    <div className="text-lg font-bold text-amber-700">{formatNumber(stats.vouchers_unused)}</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-red-600 flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> 환불</div>
                    <div className="text-lg font-bold text-red-700">{formatNumber(stats.vouchers_refunded)}</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 text-center">
                  사용률: <strong className="text-gray-900">{stats.total_vouchers_sold > 0 ? Math.round((stats.vouchers_used / stats.total_vouchers_sold) * 100) : 0}%</strong>
                </p>
              </div>

              {/* 빠른 진입 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <a href="/seller/products" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:bg-gray-50">
                  <div className="text-2xl">📦</div>
                  <div className="text-xs font-medium text-gray-700 mt-1">상품 관리</div>
                </a>
                <a href="/seller/appointments" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:bg-gray-50">
                  <div className="text-2xl">📅</div>
                  <div className="text-xs font-medium text-gray-700 mt-1">예약 관리</div>
                </a>
                <a href="/seller/ledger" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:bg-gray-50">
                  <div className="text-2xl">💰</div>
                  <div className="text-xs font-medium text-gray-700 mt-1">정산 내역</div>
                </a>
                <a href="/seller/analytics" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:bg-gray-50">
                  <div className="text-2xl">📊</div>
                  <div className="text-xs font-medium text-gray-700 mt-1">분석</div>
                </a>
              </div>
            </>
          )}
        </RoleGate>
      </div>
    </SellerLayout>
  )
}
