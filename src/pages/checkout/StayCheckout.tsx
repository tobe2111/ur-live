/**
 * 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 예약 전용 결제 화면.
 *
 * 배경: StayDetailPage 가 예약 생성 후 /checkout?order_id=N&stay=1 로 보냈지만
 *   기존 CheckoutPage 는 stay 쿼리를 무시하고 카트만 로드 → 빈카트 에러 또는 타상품 결제.
 *
 * 흐름:
 *   1) GET /api/group-buy/stays/orders/:id — 서버 주문 요약(숙소/체크인아웃/금액) 표시.
 *      금액은 항상 서버 orders.total_amount — 클라이언트 재계산 금지.
 *   2) 결제하기 → /pay/widget (TossWidgetPayPage, V2 widgets() SDK — 잠금 파일, 호출만).
 *      Toss orderId = 'STAY-{orders.id}' — 서버 confirm(stays-public.routes) 과 동일 문자열.
 *   3) successUrl/failUrl → /stays/checkout-return?order_id=N (confirm 호출 경량 페이지).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertCircle, Calendar, Users } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { useForceLightTheme } from '@/hooks/useForceLightTheme'

interface StayOrderBooking {
  id: number
  room_id: number | null
  check_in_date: string | null
  check_out_date: string | null
  nights: number | null
  guest_count: number | null
  guest_name: string | null
  status: string
  total_amount: number
  sale_mode: string | null
  voucher_type: string | null
  voucher_expires_at: string | null
  product_name: string | null
  image_url: string | null
  room_name: string | null
}

interface StayOrder {
  id: number
  total_amount: number
  status: string
  payment_status: string
}

export default function StayCheckout({ orderId }: { orderId: number }) {
  // 결제 화면은 라이트 테마 고정 (CheckoutPage 와 동일 — 금액 명료성 최우선).
  useForceLightTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<StayOrder | null>(null)
  const [bookings, setBookings] = useState<StayOrderBooking[]>([])
  const [clientKey, setClientKey] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token')
    Promise.all([
      api.get(`/api/group-buy/stays/orders/${orderId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
      // 서버 clientKey 단일 진실원천 (Cloudflare env 변경 즉시 반영) — CheckoutPage 와 동일 패턴.
      api.get('/api/payments/client-key', { params: { _ts: Date.now() } }).catch(() => null),
    ])
      .then(([orderRes, keyRes]) => {
        if (orderRes.data?.success) {
          setOrder(orderRes.data.data.order as StayOrder)
          setBookings((orderRes.data.data.bookings || []) as StayOrderBooking[])
        } else {
          setError(orderRes.data?.error || '주문을 불러오지 못했습니다')
        }
        const keyData = keyRes?.data?.data || {}
        const key = keyData.clientKey || keyRes?.data?.clientKey
        if (key && typeof key === 'string') setClientKey(key)
      })
      .catch((err: unknown) => {
        const ax = err as { response?: { status?: number; data?: { error?: string } } }
        if (ax.response?.status === 401) {
          navigate(`/login?returnUrl=${encodeURIComponent(`/checkout?order_id=${orderId}&stay=1`)}`)
          return
        }
        setError(ax.response?.data?.error || '주문을 불러오지 못했습니다')
      })
      .finally(() => setLoading(false))
  }, [orderId, navigate])

  function handlePay() {
    if (!order || !clientKey) return
    const first = bookings[0]
    const baseName = first?.product_name
      ? `${first.product_name}${first.room_name ? ` ${first.room_name}` : ''}`
      : '숙소 예약'
    const orderName = bookings.length > 1 ? `${baseName} 외 ${bookings.length - 1}건` : baseName
    const returnPath = `/stays/checkout-return?order_id=${order.id}`
    const params = new URLSearchParams({
      // 서버 confirm 이 동일 문자열 'STAY-{orders.id}' 로 토스 승인 호출 — 반드시 일치해야 함.
      orderId: `STAY-${order.id}`,
      amount: String(order.total_amount),  // 서버 주문 금액 그대로 — 클라 재계산 금지.
      orderName,
      clientKey,
      successUrl: returnPath,
      failUrl: returnPath,
    })
    navigate(`/pay/widget?${params.toString()}`)
  }

  const alreadyPaid = order?.payment_status === 'approved'
  const notPayable = !!order && !alreadyPaid && String(order.status).toUpperCase() !== 'PENDING'

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title="숙소 결제 - 유어딜" description="숙소 예약 결제" url="/checkout" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900">숙소 결제</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4 pb-36">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error || !order ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-[13px] font-medium text-red-800">{error || '주문을 불러오지 못했습니다'}</p>
            </div>
            <button onClick={() => navigate('/stays')} className="mt-3 text-[12px] text-blue-600 underline font-medium">
              숙소 둘러보기로 이동
            </button>
          </div>
        ) : (
          <>
            {/* 예약 요약 — 서버 데이터 그대로 표시 */}
            <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-[12px] text-gray-500">예약 내역 ({bookings.length}건)</p>
              {bookings.map((b) => (
                <div key={b.id} className="flex items-start gap-3 pt-1">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {b.image_url ? <img src={b.image_url} alt={b.product_name || ''} className="w-full h-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 line-clamp-1">{b.product_name || '숙소'}</p>
                    {b.room_name && <p className="text-[12px] text-gray-600">{b.room_name}</p>}
                    <p className="text-[12px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {b.check_in_date
                        ? `${b.check_in_date} → ${b.check_out_date} (${b.nights || 1}박)`
                        : `숙소권 ${b.voucher_type === 'weekend' ? '주말권' : '평일권'} × ${b.nights || 1}박 (날짜 협의)`}
                    </p>
                    {(b.guest_count || 0) > 0 && (
                      <p className="text-[12px] text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0" /> {b.guest_count}명
                      </p>
                    )}
                  </div>
                  <p className="text-[13px] font-bold text-gray-900 shrink-0">₩{formatNumber(b.total_amount)}</p>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[13px] text-gray-500">총 결제 금액</span>
                <span className="text-[20px] font-extrabold text-gray-900">
                  {formatNumber(order.total_amount)}
                  <span className="text-[14px] font-bold ml-0.5">원</span>
                </span>
              </div>
            </section>

            {alreadyPaid && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <p className="text-[13px] font-bold text-emerald-700">이미 결제가 완료된 주문입니다.</p>
                <button onClick={() => navigate('/my-stays')} className="mt-2 text-[12px] text-blue-600 underline font-medium">
                  내 숙소 예약 보기 →
                </button>
              </div>
            )}
            {notPayable && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[13px] font-medium text-amber-800">
                  결제할 수 없는 주문 상태입니다 ({order.status}). 예약을 다시 생성해주세요.
                </p>
              </div>
            )}
            {!alreadyPaid && !notPayable && !clientKey && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-[13px] font-medium text-red-800">결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* 하단 결제 버튼 */}
      {!loading && order && !alreadyPaid && !notPayable && (
        <div
          className="fixed bottom-0 left-0 right-0 xl:left-56 bg-white border-t border-gray-100 z-30"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="ur-content-narrow px-4 pt-3">
            <button
              onClick={handlePay}
              disabled={!clientKey}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {formatNumber(order.total_amount)}원 결제하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
