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

interface DiagnoseResponse {
  order: { id: number; order_number: string; status: string; payment_method: string; total_amount: number; created_at: string; user_id: string; user_name: string | null; user_phone: string | null; phone_ok: boolean; masked_user_phone: string | null }
  settings_status: Record<string, boolean>
  order_items: Array<{ product_id: number; product_name: string; quantity: number; unit_price: number; kt_alpha_gift_code: string | null; auto_voucher_send: number | null }>
  kt_alpha_target_items_count: number
  voucher_orders: Array<{ id: number; goods_name: string; status: string; failure_reason: string | null; recipient_phone: string; sent_at: string | null; external_order_id: string }>
  vouchers: Array<{ id: number; code: string; status: string; created_at: string }>
  frontend_errors: Array<{ type: string; message: string; created_at: string }>
  diagnosis: string[]
  recommendations: string[]
}

function DiagnoseModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [data, setData] = useState<DiagnoseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 🛡️ 2026-05-25: 재발송 trigger state
  const [triggering, setTriggering] = useState(false)
  const [triggerResult, setTriggerResult] = useState<string | null>(null)

  async function triggerResend() {
    if (!confirm(`Order #${orderId} 에 KT Alpha 자동발송을 수동 trigger 합니다. 진행하시겠습니까?`)) return
    setTriggering(true)
    setTriggerResult(null)
    try {
      const r = await api.post(`/api/admin/kt-alpha/trigger-order/${orderId}`, {})
      if (r.data?.success) {
        // 🛡️ 2026-05-25: errors 배열 노출 — 실패 시 정확한 사유 표시
        const errs = (r.data.errors as string[]) || []
        const msg = r.data.message || '재발송 trigger 완료'
        setTriggerResult(errs.length > 0 ? `${msg}\n\n에러:\n• ${errs.join('\n• ')}` : msg)
        const refresh = await api.get(`/api/admin/kt-alpha/diagnose-order/${orderId}`)
        if (refresh.data?.success) setData(refresh.data.data)
      } else {
        setTriggerResult(`실패: ${r.data?.error || 'unknown'}`)
      }
    } catch (err: any) {
      setTriggerResult(`실패: ${err?.response?.data?.error || err?.message || 'unknown'}`)
    } finally {
      setTriggering(false)
    }
  }

  useEffect(() => {
    api.get(`/api/admin/kt-alpha/diagnose-order/${orderId}`)
      .then(r => {
        if (r.data?.success) setData(r.data.data)
        else setError(r.data?.error || '조회 실패')
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [orderId])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">KT Alpha 진단 — Order #{orderId}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        {/* 🛡️ 2026-05-25: 재발송 trigger — autoSendKtAlphaVouchersForOrders 수동 호출 */}
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-900 mb-2">🚀 KT Alpha 재발송 trigger</p>
          <p className="text-[11px] text-amber-700 mb-2">
            voucher_orders 기록 없음 (autoSendKtAlphaVouchersForOrders 미실행) 케이스 → 수동 발송.
            동기 호출 (응답 ~1-3초). 이미 성공 status 인 voucher_orders 는 영향 없음.
          </p>
          <button
            onClick={triggerResend}
            disabled={triggering}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
          >
            {triggering ? '발송 중...' : '🚀 KT Alpha 재발송 trigger'}
          </button>
          {triggerResult && (
            <pre className={`mt-2 text-xs font-bold whitespace-pre-wrap break-words ${triggerResult.startsWith('실패') || triggerResult.includes('에러:') ? 'text-red-600' : 'text-emerald-600'}`}>
              {triggerResult}
            </pre>
          )}
        </div>

        {loading ? (
          <p className="text-center py-8 text-gray-500">진단 중...</p>
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : data ? (
          <div className="space-y-4 text-sm">
            {/* 진단 결과 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-bold text-gray-900 mb-2">📋 진단</p>
              {data.diagnosis.length === 0 ? <p className="text-gray-500">진단 항목 없음</p>
                : data.diagnosis.map((d, i) => (
                  <p key={i} className="text-gray-800 mb-1">{d}</p>
                ))
              }
            </div>

            {/* 권장 액션 */}
            {data.recommendations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-bold text-amber-900 mb-2">💡 권장 액션</p>
                {data.recommendations.map((r, i) => (
                  <p key={i} className="text-amber-800 mb-1">• {r}</p>
                ))}
              </div>
            )}

            {/* 주문 + 사용자 */}
            <div>
              <p className="font-bold text-gray-900 mb-1">주문</p>
              <p className="text-xs text-gray-600">order_number: {data.order.order_number}</p>
              <p className="text-xs text-gray-600">총액: {formatWon(data.order.total_amount)} · 결제: {data.order.payment_method}</p>
              <p className="text-xs text-gray-600">사용자: {data.order.user_name || '-'} (id {data.order.user_id})</p>
              <p className="text-xs text-gray-600">phone: {data.order.masked_user_phone || '없음'} {data.order.phone_ok ? '✅' : '❌'}</p>
            </div>

            {/* 설정 */}
            <div>
              <p className="font-bold text-gray-900 mb-1">KT Alpha 설정</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(data.settings_status).map(([k, v]) => (
                  <p key={k} className={v ? 'text-emerald-600' : 'text-red-600'}>
                    {v ? '✅' : '❌'} {k}
                  </p>
                ))}
              </div>
            </div>

            {/* 주문 상품 */}
            <div>
              <p className="font-bold text-gray-900 mb-1">상품 ({data.order_items.length})</p>
              {data.order_items.map((it, i) => (
                <div key={i} className="text-xs bg-gray-50 rounded p-2 mb-1">
                  <p className="text-gray-900 font-medium">{it.product_name}</p>
                  <p className="text-gray-500">
                    수량 {it.quantity} · 단가 {formatWon(it.unit_price)}
                  </p>
                  <p className="text-gray-500">
                    kt_alpha_gift_code: <span className={it.kt_alpha_gift_code ? 'text-emerald-600' : 'text-red-600'}>{it.kt_alpha_gift_code || '없음'}</span>
                  </p>
                  <p className="text-gray-500">
                    auto_voucher_send: <span className={it.auto_voucher_send === 1 ? 'text-emerald-600' : 'text-red-600'}>{it.auto_voucher_send === 1 ? '1 (ON)' : '0 (OFF)'}</span>
                  </p>
                </div>
              ))}
              <p className="text-xs text-gray-600 mt-1">KT Alpha 발송 대상: <b>{data.kt_alpha_target_items_count}</b>개</p>
            </div>

            {/* KT Alpha voucher_orders */}
            <div>
              <p className="font-bold text-gray-900 mb-1">KT Alpha 발송 기록 ({data.voucher_orders.length})</p>
              {data.voucher_orders.length === 0 ? (
                <p className="text-xs text-red-600">기록 없음 — autoSendKtAlphaVouchersForOrders 미실행</p>
              ) : data.voucher_orders.map(vo => (
                <div key={vo.id} className="text-xs bg-gray-50 rounded p-2 mb-1">
                  <p className={
                    vo.status === 'sent' ? 'text-emerald-600 font-bold'
                    : vo.status === 'failed' ? 'text-red-600 font-bold'
                    : 'text-gray-600 font-bold'
                  }>
                    {vo.status === 'sent' ? '✅ sent' : vo.status === 'failed' ? '❌ failed' : '⏳ processing'} · {vo.goods_name}
                  </p>
                  {vo.failure_reason && <p className="text-red-600 text-[10px]">{vo.failure_reason}</p>}
                  <p className="text-gray-500 text-[10px]">→ {vo.recipient_phone || '(no phone)'}</p>
                </div>
              ))}
            </div>

            {/* 내부 QR vouchers */}
            <div>
              <p className="font-bold text-gray-900 mb-1">내부 QR voucher ({data.vouchers.length})</p>
              {data.vouchers.map(v => (
                <p key={v.id} className="text-xs text-gray-600">{v.code} · {v.status}</p>
              ))}
            </div>

            {/* frontend_errors */}
            {data.frontend_errors.length > 0 && (
              <div>
                <p className="font-bold text-gray-900 mb-1">관련 에러 로그</p>
                {data.frontend_errors.map((e, i) => (
                  <p key={i} className="text-xs text-gray-600">[{e.type}] {e.message}</p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
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
  const [diagOrderId, setDiagOrderId] = useState<number | null>(null)
  const [diagInputValue, setDiagInputValue] = useState('')

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
          <p className="text-xs text-gray-500 mb-3">사용자 voucher 구매 내역. KT Alpha 자동발송 status 는 별도 추적 페이지에서 확인.</p>

          {/* 🛡️ 2026-05-24 사용자 명령: order_id 직접 입력해 KT Alpha 연동 진단 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-900 mb-2">🔍 order_id 로 KT Alpha 연동 진단</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={diagInputValue}
                onChange={(e) => setDiagInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && diagInputValue) {
                    setDiagOrderId(Number(diagInputValue))
                  }
                }}
                placeholder="예: 12345"
                className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded text-gray-900"
              />
              <button
                onClick={() => { if (diagInputValue) setDiagOrderId(Number(diagInputValue)) }}
                disabled={!diagInputValue}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded disabled:opacity-40"
              >
                진단
              </button>
            </div>
            <p className="text-[10px] text-blue-700 mt-1">아래 테이블의 "주문" 컬럼에서 order_id 확인 가능. 행의 "진단" 버튼으로도 동일.</p>
          </div>
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
                <th className="py-2 px-3 text-center">진단</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-8 text-center text-gray-500">로딩 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="py-8 text-center text-gray-500">거래 없음</td></tr>
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
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => setDiagOrderId(r.order_id)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-200"
                    >
                      진단
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 진단 모달 */}
        {diagOrderId && <DiagnoseModal orderId={diagOrderId} onClose={() => setDiagOrderId(null)} />}

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
