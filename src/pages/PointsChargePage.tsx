import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { ArrowLeft, Zap, Loader2, Info, Check } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

interface ChargeOption {
  amount: number
  points: number
  label: string
  bonus?: number
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
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }),
      api.get('/api/points/charge-options').then(r => {
        if (r.data.success) {
          setOptions(r.data.data)
          setSelected(r.data.data[1] ?? r.data.data[0])
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }),
    ]).finally(() => setLoading(false))
  }, [userId, navigate])

  useEffect(() => {
    if (!showWidget || !widgetsRef.current) return
    const widgets = widgetsRef.current as { renderPaymentMethods: Function; renderAgreement: Function; setAmount: Function }

    const timer = setTimeout(async () => {
      try {
        await widgets.renderPaymentMethods({ selector: '#charge-payment-method', variantKey: 'widgetA' })
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
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  const pointsPreview = selected?.points ?? 0
  const bonusPoints = selected?.bonus ?? 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <SEO title="딜 충전 - 유어딜" description="딜 포인트를 충전하세요" url="/points/charge" noindex />

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">딜 충전</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5 pb-28 space-y-4">
        {/* 현재 잔액 카드 */}
        <section className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white shadow-md">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 fill-white" strokeWidth={0} />
              <span className="text-[12px] font-semibold opacity-90">내 딜 잔액</span>
            </div>
            <p className="text-[32px] font-extrabold leading-none tracking-tight">
              {formatNumber(balance)}
              <span className="text-[16px] font-bold ml-1">딜</span>
            </p>
            <p className="text-[11px] font-medium opacity-80 mt-2">1원 = 1딜 · 수수료 없음</p>
          </div>
        </section>

        {!showWidget && (
          <>
            {/* 충전 금액 선택 */}
            <section>
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-[14px] font-bold text-gray-900 dark:text-white">충전 금액</h2>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">원하는 금액을 선택하세요</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {options.map(opt => {
                  const isSelected = selected?.amount === opt.amount
                  const hasBonus = opt.bonus && opt.bonus > 0
                  return (
                    <button
                      key={opt.amount}
                      onClick={() => setSelected(opt)}
                      className={`relative flex flex-col items-center justify-center py-5 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] hover:border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                      {hasBonus && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900 text-[9px] font-extrabold">
                          +{opt.bonus?.toLocaleString()}딜
                        </span>
                      )}
                      <p className={`text-[18px] font-extrabold ${isSelected ? 'text-pink-600' : 'text-gray-900 dark:text-white'}`}>
                        {formatNumber(opt.amount)}
                        <span className="text-[12px] font-bold ml-0.5">원</span>
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                        {formatNumber(opt.points)}딜
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 충전 후 잔액 미리보기 */}
            {selected && (
              <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500 dark:text-gray-400">현재 잔액</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(balance)}딜</span>
                </div>
                <div className="flex items-center justify-between text-[13px] mt-2">
                  <span className="text-gray-500 dark:text-gray-400">충전 딜</span>
                  <span className="font-semibold text-pink-600">
                    +{formatNumber(pointsPreview)}딜
                    {bonusPoints > 0 && <span className="text-amber-600 ml-1">(+{formatNumber(bonusPoints)}딜 보너스)</span>}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white">충전 후 잔액</span>
                  <span className="text-[18px] font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(balance + pointsPreview + bonusPoints)}
                    <span className="text-[13px] font-bold ml-0.5">딜</span>
                  </span>
                </div>
              </section>
            )}

            {/* 안내 */}
            <section className="flex gap-2.5 px-3 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
              <div className="text-[12px] leading-relaxed">
                <p className="font-semibold text-amber-800">충전된 딜은 환불이 불가합니다</p>
                <p className="text-amber-700 mt-0.5">
                  라이브 방송 후원 및 상품 결제에만 사용 가능합니다.
                </p>
              </div>
            </section>
          </>
        )}

        {/* 결제 위젯 */}
        {showWidget && (
          <>
            <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">충전 내역</span>
                <div className="text-right">
                  <p className="text-[16px] font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(selected?.amount)}
                    <span className="text-[12px] font-bold ml-0.5">원</span>
                  </p>
                  <p className="text-[11px] font-semibold text-pink-600">
                    → {formatNumber(selected?.points)}딜
                  </p>
                </div>
              </div>
            </section>

            <div id="charge-payment-method" className="min-h-[200px] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-2" />
            <div id="charge-agreement" className="min-h-[80px] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-2" />

            <p className="text-[11px] text-center text-amber-700 font-semibold">
              결제 완료 시 충전된 딜은 환불이 불가합니다.
            </p>
          </>
        )}
      </main>

      {/* 하단 고정 CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-md px-4 pt-3">
          {showWidget ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setShowWidget(false); widgetsRef.current = null; orderRef.current = null }}
                className="w-24 py-3.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 text-[14px] font-bold rounded-full hover:bg-gray-200 transition-colors"
              >
                이전
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="flex-1 py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  `${formatNumber(selected?.amount)}원 결제`
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleCharge}
              disabled={!selected || processing}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  결제 준비 중…
                </span>
              ) : (
                `${formatNumber(pointsPreview + bonusPoints)}딜 충전하기`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
