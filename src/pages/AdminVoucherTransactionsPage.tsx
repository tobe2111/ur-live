/**
 * 🛡️ 2026-05-24 Q1 (사용자 요청): 어드민 교환권 거래 분리 표시 페이지.
 *   누가 / 언제 / 어떤 교환권 — voucher 구매 내역 (KT Alpha 발송 추적과 별개).
 *
 * 데이터:
 *   - GET /api/admin/vouchers/transactions?limit=&offset=&status=&user_id=&date_from=&date_to=&category=
 *
 * UI:
 *   - 필터: 기간 / 상태 / 카테고리 / user_id
 *   - 테이블: 시각, 사용자(이름·전화), 상품, 식당, 가격(applied_price), 결제수단, 상태, code
 *   - 페이지네이션 (50 per page)
 *   - 상단 합계 카드: 오늘 거래 수 / 오늘 거래 금액 (대시보드 stats 재사용)
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber, formatWon } from '@/utils/format'

interface VoucherTxRow {
  id: number
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded'
  created_at: string
  used_at: string | null
  expires_at: string | null
  applied_price: number | null
  applied_discount_pct: number | null
  user_id: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  order_id: number
  order_number: string | null
  order_total: number | null
  payment_method: string | null
  product_id: number
  product_name: string | null
  product_image: string | null
  category: string | null
  restaurant_name: string | null
  seller_id: number | null
  seller_name: string | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unused:   { label: '미사용', cls: 'bg-emerald-100 text-emerald-700' },
  used:     { label: '사용됨', cls: 'bg-gray-100 text-gray-600' },
  expired:  { label: '만료',   cls: 'bg-red-100 text-red-700' },
  refunded: { label: '환불',   cls: 'bg-yellow-100 text-yellow-700' },
}

const PAGE_SIZE = 50

export default function AdminVoucherTransactionsPage() {
  const [rows, setRows] = useState<VoucherTxRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<'' | 'unused' | 'used' | 'expired' | 'refunded'>('')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')
  const [todayStats, setTodayStats] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 })

  useEffect(() => {
    api.get('/api/admin/dashboard/stats')
      .then(r => {
        if (r.data?.success) {
          setTodayStats({
            count: r.data.data?.todayVouchers || 0,
            amount: r.data.data?.todayVouchersAmount || 0,
          })
        }
      })
      .catch(() => null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (status) params.set('status', status)
      if (userId.trim()) params.set('user_id', userId.trim())
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (category) params.set('category', category)
      const res = await api.get(`/api/admin/vouchers/transactions?${params.toString()}`)
      if (res.data?.success) {
        setRows(res.data.data?.rows || [])
        setTotal(res.data.data?.total || 0)
      } else {
        toast.error(res.data?.error || '조회 실패')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, status, userId, dateFrom, dateTo, category])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SEO title="교환권 거래 — 어드민" url="/admin/voucher-transactions" noindex />
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">교환권 거래</h1>
            <Link to="/admin/voucher-orders" className="text-xs text-pink-600 hover:underline">KT Alpha 발송 추적 →</Link>
          </div>
          <p className="text-xs text-gray-500">사용자 voucher 구매 내역. KT Alpha 자동발송 status 는 별도 추적 페이지에서 확인.</p>
        </div>

        {/* 오늘 합계 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">오늘 거래 수</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(todayStats.count)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">오늘 거래 금액 (applied_price 합)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatWon(todayStats.amount)}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">상태</label>
              <select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value as typeof status) }}
                className="w-full text-sm border rounded px-2 py-1.5 text-gray-900">
                <option value="">전체</option>
                <option value="unused">미사용</option>
                <option value="used">사용됨</option>
                <option value="expired">만료</option>
                <option value="refunded">환불</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">카테고리</label>
              <select value={category} onChange={(e) => { setPage(0); setCategory(e.target.value) }}
                className="w-full text-sm border rounded px-2 py-1.5 text-gray-900">
                <option value="">전체</option>
                <option value="meal_voucher">식사권</option>
                <option value="beauty_voucher">뷰티</option>
                <option value="stay_voucher">숙박</option>
                <option value="etc_voucher">기타</option>
                <option value="health_voucher">건강</option>
                <option value="pet_voucher">펫</option>
                <option value="activity_voucher">액티비티</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">시작일</label>
              <input type="date" value={dateFrom} onChange={(e) => { setPage(0); setDateFrom(e.target.value) }}
                className="w-full text-sm border rounded px-2 py-1.5 text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">종료일</label>
              <input type="date" value={dateTo} onChange={(e) => { setPage(0); setDateTo(e.target.value) }}
                className="w-full text-sm border rounded px-2 py-1.5 text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">user_id</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); load() } }}
                placeholder="enter 로 검색"
                className="w-full text-sm border rounded px-2 py-1.5 text-gray-900" />
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-700">
                <th className="py-2 px-3 text-left">시각 (KST)</th>
                <th className="py-2 px-3 text-left">사용자</th>
                <th className="py-2 px-3 text-left">상품</th>
                <th className="py-2 px-3 text-left">매장</th>
                <th className="py-2 px-3 text-right">applied_price</th>
                <th className="py-2 px-3 text-center">결제</th>
                <th className="py-2 px-3 text-center">상태</th>
                <th className="py-2 px-3 text-left">코드</th>
                <th className="py-2 px-3 text-left">주문</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">로딩 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">거래 없음</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2 px-3 text-gray-900">
                    <div className="font-medium">{r.user_name || `user ${r.user_id}`}</div>
                    <div className="text-[10px] text-gray-500">{r.user_email || r.user_phone || `id ${r.user_id}`}</div>
                  </td>
                  <td className="py-2 px-3 text-gray-900">
                    <div className="font-medium">{r.product_name || `상품 ${r.product_id}`}</div>
                    <div className="text-[10px] text-gray-500">{r.category || '-'}</div>
                  </td>
                  <td className="py-2 px-3 text-gray-700">
                    {r.restaurant_name || r.seller_name || '-'}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-900 font-mono">
                    {r.applied_price != null ? formatWon(r.applied_price) : '-'}
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600">{r.payment_method || '-'}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_LABEL[r.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_LABEL[r.status]?.label || r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-600 font-mono text-[10px]">{r.code}</td>
                  <td className="py-2 px-3 text-gray-500 text-[10px]">{r.order_number || `#${r.order_id}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-600">전체 {formatNumber(total)}건 · 페이지 {page + 1}/{totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-xs border rounded text-gray-700 disabled:opacity-40">이전</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs border rounded text-gray-700 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
