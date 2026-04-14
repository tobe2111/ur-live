import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { ArrowLeft, Zap, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'live_gck_yL0qZ4G1VOdvERE6vv6oroWb2MQY'

interface ChargeOption {
  amount: number
  points: number
  label: string
}

export default function PointsChargePage() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  const [options, setOptions] = useState<ChargeOption[]>([])
  const [selected, setSelected] = useState<ChargeOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showWidget, setShowWidget] = useState(false)
  const widgetsRef = useRef<unknown>(null)
  const orderRef = useRef<{ orderId: string; orderName: string } | null>(null)
  const userId = getUserIdSync()

  useEffect(() => {
    if (!userId) { navigate('/login'); return }
    Promise.all([
      api.get('/api/points/balance').then(r => {
        if (r.data.success) setBalance(r.data.data.balance)
      }),
      api.get('/api/points/charge-options').then(r => {
        if (r.data.success) {
          setOptions(r.data.data)
          setSelected(r.data.data[1])
        }
      }),
    ]).finally(() => setLoading(false))
  }, [userId, navigate])

  useEffect(() => {
    if (!showWidget || !widgetsRef.current) return
    const widgets = widgetsRef.current as { renderPaymentMethods: Function; renderAgreement: Function; setAmount: Function }

    const timer = setTimeout(async () => {
      try {
        await widgets.renderPaymentMethods({ selector: '#charge-payment-method', variantKey: 'DEFAULT' })
        await widgets.renderAgreement({ selector: '#charge-agreement', variantKey: 'AGREEMENT' })
        setProcessing(false)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '결제창 로드에 실패했습니다.'
        toast.error(msg)
        setShowWidget(false)
        setProcessing(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [showWidget])

  async function handleCharge() {
    if (!selected || !userId) return
    setProcessing(true)

    try {
      const initRes = await api.post('/api/points/charge/init', { amount: selected.amount })
      if (!initRes.data.success) {
        toast.error(initRes.data.error || '충전 시작에 실패했습니다.')
        setProcessing(false)
        return
      }

      const { orderId, amount, orderName, clientKey: serverClientKey } = initRes.data.data

      const tossPayments = await loadTossPayments(serverClientKey || clientKey)
      const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
      const widgets = tossPayments.widgets({ customerKey: `user_${sanitizedUserId}` })

      await widgets.setAmount({ currency: 'KRW', value: amount })

      widgetsRef.current = widgets
      orderRef.current = { orderId, orderName }
      setShowWidget(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '결제 준비에 실패했습니다.'
      toast.error(msg)
      setProcessing(false)
    }
  }

  async function handleConfirmPayment() {
    const widgets = widgetsRef.current as { requestPayment: Function } | null
    if (!widgets || !orderRef.current) return

    setProcessing(true)
    try {
      await widgets.requestPayment({
        orderId: orderRef.current.orderId,
        orderName: orderRef.current.orderName,
        successUrl: `${window.location.origin}/points/charge/success`,
        failUrl: `${window.location.origin}/points/charge/fail`,
      })
    } catch (err: unknown) {
      setProcessing(false)
      const code = (err as Record<string, string>)?.code
      if (code === 'USER_CANCEL') return
      const msg = err instanceof Error ? err.message : '결제 요청에 실패했습니다.'
      toast.error(msg)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-lg px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900">딜 충전</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-5 py-6 space-y-5">
        {/* 현재 잔액 */}
        <div className="bg-gradient-to-r from-pink-500 to-red-500 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">내 딜 잔액</span>
          </div>
          <p className="text-3xl font-bold">{balance.toLocaleString()}딜</p>
        </div>

        {/* 충전 금액 선택 */}
        {!showWidget && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">충전 금액 선택</h2>
            <div className="space-y-2">
              {options.map(opt => (
                <button
                  key={opt.amount}
                  onClick={() => setSelected(opt)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                    selected?.amount === opt.amount
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm font-bold text-gray-900">{opt.amount.toLocaleString()}원</span>
                  <span className="text-sm font-bold text-pink-400">{opt.points.toLocaleString()}딜</span>
                </button>
              ))}
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-amber-400 font-medium">충전된 딜은 환불이 불가합니다.</p>
              <p className="text-xs text-amber-600 mt-0.5">충전 전 금액을 확인해주세요. 딜은 라이브 방송 후원 및 상품 결제에만 사용 가능합니다.</p>
            </div>
          </div>
        )}

        {/* 결제 위젯 영역 */}
        {showWidget && (
          <>
            <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-400">충전 금액</span>
              <span className="text-sm font-bold text-pink-400">{selected?.amount.toLocaleString()}원 → {selected?.points.toLocaleString()}딜</span>
            </div>
            <div id="charge-payment-method" className="min-h-[200px] bg-white rounded-xl border border-gray-200 p-2" />
            <div id="charge-agreement" className="min-h-[80px] bg-white rounded-xl border border-gray-200 p-2" />
            <p className="text-xs text-center text-amber-400 font-medium">결제 완료 시 충전된 딜은 환불이 불가합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowWidget(false); widgetsRef.current = null; orderRef.current = null }}
                className="flex-1 py-4 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl"
              >
                뒤로
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="flex-[2] py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white text-lg font-bold rounded-xl shadow-lg disabled:opacity-60"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `${selected?.amount.toLocaleString()}원 결제하기`}
              </button>
            </div>
          </>
        )}

        {/* 충전 버튼 (위젯 표시 전) */}
        {!showWidget && (
          <button
            onClick={handleCharge}
            disabled={!selected || processing}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white text-lg font-bold rounded-xl shadow-lg disabled:opacity-60"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> 결제 준비 중...
              </span>
            ) : (
              `${selected?.points.toLocaleString()}딜 충전하기`
            )}
          </button>
        )}
      </div>
    </div>
  )
}
