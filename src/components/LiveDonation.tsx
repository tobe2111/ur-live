/**
 * LiveDonation — 라이브 후원 UI
 *
 * 1. 후원 버튼 (하트 아이콘)
 * 2. 금액 선택 바텀시트
 * 3. 결제 처리 (토스페이먼츠 SDK v2)
 * 4. 후원 이펙트 애니메이션 (WebSocket으로 수신)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, X, Loader2 } from 'lucide-react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync as getUserId } from '@/utils/auth'

interface DonationEffect {
  id: string
  donorName: string
  amount: number
  message: string
}

interface LiveDonationProps {
  streamId: number
  onDonationEffect?: (effect: DonationEffect) => void
}

const DONATION_AMOUNTS = [
  { amount: 1000,  label: '1,000원',  emoji: '💛' },
  { amount: 3000,  label: '3,000원',  emoji: '🧡' },
  { amount: 5000,  label: '5,000원',  emoji: '❤️' },
  { amount: 10000, label: '10,000원', emoji: '💎' },
  { amount: 30000, label: '30,000원', emoji: '👑' },
  { amount: 50000, label: '50,000원', emoji: '🌟' },
]

export default function LiveDonation({ streamId }: LiveDonationProps) {
  const [showSheet, setShowSheet] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(DONATION_AMOUNTS[0])
  const [message, setMessage] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentStep, setPaymentStep] = useState<'select' | 'paying'>('select')
  const paymentContainerRef = useRef<HTMLDivElement>(null)
  const widgetsRef = useRef<any>(null)

  const userId = getUserId()

  // 바텀시트 닫힐 때 결제 상태 초기화
  useEffect(() => {
    if (!showSheet) {
      setPaymentStep('select')
      widgetsRef.current = null
    }
  }, [showSheet])

  const handleDonate = useCallback(async () => {
    if (!userId) {
      toast.error('로그인이 필요합니다.')
      return
    }

    setProcessing(true)
    try {
      // 1. 후원 결제 초기화 (서버에서 PENDING 레코드 생성)
      const res = await api.post('/api/donations/init', {
        stream_id: streamId,
        amount: selectedAmount.amount,
        message: message.trim() || undefined,
      })

      if (!res.data.success) {
        toast.error(res.data.error || '후원 생성에 실패했습니다.')
        return
      }

      const { orderId, amount, orderName, clientKey } = res.data.data

      // 2. 토스페이먼츠 SDK v2 로드 및 위젯 초기화
      const tossPayments = await loadTossPayments(clientKey)

      const sanitizedUserId = String(userId)
        .replace(/[^a-zA-Z0-9\-_=.@]/g, '')
        .substring(0, 44)
      const customerKey = `user_${sanitizedUserId}`

      const widgets = tossPayments.widgets({ customerKey })
      widgetsRef.current = widgets

      // 금액 설정
      await widgets.setAmount({ currency: 'KRW', value: amount })

      // 결제 UI 단계로 전환
      setPaymentStep('paying')

      // DOM 렌더 대기 후 위젯 렌더링
      await new Promise(resolve => setTimeout(resolve, 100))

      // 결제 수단 + 약관 동의 UI 렌더링
      await widgets.renderPaymentMethods({
        selector: '#donation-payment-method',
        variantKey: 'DEFAULT',
      })

      await widgets.renderAgreement({
        selector: '#donation-agreement',
        variantKey: 'AGREEMENT',
      })

      setProcessing(false)

      // 결제 버튼은 사용자가 직접 클릭 (handleConfirmPayment)
      // orderId, amount, orderName을 ref에 저장
      widgetsRef.current._donationMeta = { orderId, amount, orderName }
    } catch (err: any) {
      console.error('[Donation] Init/Render error:', err)
      toast.error('결제 준비 중 오류가 발생했습니다.')
      setPaymentStep('select')
      setProcessing(false)
    }
  }, [userId, streamId, selectedAmount, message])

  const handleConfirmPayment = useCallback(async () => {
    const widgets = widgetsRef.current
    if (!widgets || !widgets._donationMeta) return

    const { orderId, amount, orderName } = widgets._donationMeta
    setProcessing(true)

    try {
      // Toss 위젯 결제 요청 (리다이렉트 없이 Promise 반환)
      // successUrl/failUrl 미지정 시 인라인 모드로 동작
      const paymentResult = await widgets.requestPayment({
        orderId,
        orderName,
      })

      // 결제 성공 → 서버에서 승인 처리
      if (paymentResult?.paymentKey) {
        const confirmRes = await api.post('/api/donations/confirm', {
          paymentKey: paymentResult.paymentKey,
          orderId,
          amount,
        })
        if (confirmRes.data.success) {
          toast.success(confirmRes.data.message || '후원이 완료되었습니다!')
          setShowSheet(false)
          setMessage('')
          setPaymentStep('select')
        } else {
          toast.error(confirmRes.data.error || '후원 처리에 실패했습니다.')
        }
      }
    } catch (err: any) {
      if (err?.code === 'USER_CANCEL') {
        toast.info('후원이 취소되었습니다.')
      } else if (err?.code === 'INVALID_CARD_COMPANY') {
        toast.error('카드사 오류가 발생했습니다. 다른 결제 수단을 선택해주세요.')
      } else {
        toast.error(err?.message || '결제 중 오류가 발생했습니다.')
        console.error('[Donation] Payment error:', err)
      }
    } finally {
      setProcessing(false)
    }
  }, [])

  return (
    <>
      {/* 후원 버튼 */}
      <button
        onClick={() => setShowSheet(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500/20 backdrop-blur-sm transition-all active:scale-90"
        aria-label="후원하기"
      >
        <Heart className="h-5 w-5 text-pink-400" />
      </button>

      {/* 후원 바텀시트 */}
      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={() => !processing && setShowSheet(false)}
          />

          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up max-h-[90vh] overflow-y-auto">
            <div className="p-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">후원하기</h3>
                  <p className="text-xs text-gray-400 mt-0.5">셀러에게 응원을 보내세요!</p>
                </div>
                <button
                  onClick={() => !processing && setShowSheet(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              {paymentStep === 'select' ? (
                <>
                  {/* 금액 선택 */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {DONATION_AMOUNTS.map(opt => (
                      <button
                        key={opt.amount}
                        onClick={() => setSelectedAmount(opt)}
                        className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                          selectedAmount.amount === opt.amount
                            ? 'border-pink-500 bg-pink-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-xs font-bold text-gray-800">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 수수료 안내 */}
                  <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">후원 금액</span>
                      <span className="font-semibold text-gray-700">{selectedAmount.amount.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">셀러 크레딧 적립 (90%)</span>
                      <span className="font-semibold text-pink-600">
                        {Math.floor(selectedAmount.amount * 0.9).toLocaleString()}원
                      </span>
                    </div>
                  </div>

                  {/* 메시지 입력 */}
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="응원 메시지를 남겨보세요 (선택)"
                    maxLength={100}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none mb-4"
                    disabled={processing}
                  />

                  {/* 결제 진행 버튼 */}
                  <button
                    onClick={handleDonate}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-pink-500 to-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {processing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Heart className="w-5 h-5" />
                    )}
                    {processing ? '결제 준비 중...' : `${selectedAmount.amount.toLocaleString()}원 후원하기`}
                  </button>
                </>
              ) : (
                <>
                  {/* 결제 수단 선택 (SDK v2 위젯) */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      {selectedAmount.amount.toLocaleString()}원 후원 결제
                    </p>
                  </div>

                  <div
                    id="donation-payment-method"
                    ref={paymentContainerRef}
                    className="min-h-[200px] bg-white rounded-lg border border-gray-200 p-2 mb-3"
                  />

                  <div
                    id="donation-agreement"
                    className="min-h-[80px] bg-white rounded-lg border border-gray-200 p-2 mb-4"
                  />

                  {/* 결제 확인 / 뒤로가기 버튼 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!processing) {
                          setPaymentStep('select')
                          widgetsRef.current = null
                        }
                      }}
                      disabled={processing}
                      className="flex-1 py-3.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      뒤로
                    </button>
                    <button
                      onClick={handleConfirmPayment}
                      disabled={processing}
                      className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-pink-500 to-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      {processing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Heart className="w-5 h-5" />
                      )}
                      {processing ? '처리 중...' : `${selectedAmount.amount.toLocaleString()}원 결제하기`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

/**
 * 후원 이펙트 오버레이 — 후원 발생 시 화면에 표시
 */
export function DonationEffect({ donations }: { donations: DonationEffect[] }) {
  if (donations.length === 0) return null

  return (
    <div className="absolute top-20 left-0 right-0 z-[60] pointer-events-none flex flex-col items-center gap-2">
      {donations.map(d => (
        <div
          key={d.id}
          className="animate-donation-pop bg-gradient-to-r from-pink-500/90 to-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 max-w-[85%]"
        >
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-yellow-300 fill-yellow-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">
                {d.donorName}님이 {d.amount.toLocaleString()}원 후원!
              </p>
              {d.message && (
                <p className="text-xs text-white/80 truncate mt-0.5">{d.message}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
