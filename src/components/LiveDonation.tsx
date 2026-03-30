/**
 * LiveDonation — 라이브 후원 UI
 *
 * 1. 후원 버튼 (하트 아이콘)
 * 2. 금액 선택 바텀시트
 * 3. 결제 처리 (토스페이먼츠)
 * 4. 후원 이펙트 애니메이션 (WebSocket으로 수신)
 */

import { useState, useEffect, useCallback } from 'react'
import { Heart, X, Loader2 } from 'lucide-react'
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

  const userId = getUserId()

  async function handleDonate() {
    if (!userId) {
      toast.error('로그인이 필요합니다.')
      return
    }

    setProcessing(true)
    try {
      // 1. 후원 결제 초기화
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

      // 2. 토스페이먼츠 결제 (인라인 모드 - 라이브 페이지를 벗어나지 않음)
      const PaymentWidget = (window as any).PaymentWidget
      if (!PaymentWidget) {
        toast.error('결제 모듈을 불러오지 못했습니다.')
        return
      }

      const paymentWidget = PaymentWidget(clientKey, `user_${userId}`)

      // 결제 UI 렌더링을 위한 임시 전체화면 요소 생성
      const paymentContainer = document.createElement('div')
      paymentContainer.id = 'donation-payment-widget'
      paymentContainer.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white;overflow:auto;'
      document.body.appendChild(paymentContainer)

      try {
        await paymentWidget.renderPaymentMethods(
          '#donation-payment-widget',
          { value: amount },
          { variantKey: 'DEFAULT' }
        )

        // successUrl/failUrl 미지정 → 인라인 모드: 결제 완료 시 Promise resolve
        const paymentResult = await paymentWidget.requestPayment({
          orderId,
          orderName,
        })

        if (paymentResult?.paymentKey) {
          const confirmRes = await api.post('/api/donations/confirm', {
            paymentKey: paymentResult.paymentKey,
            orderId,
            amount,
            stream_id: streamId,
            message: message.trim() || undefined,
          })
          if (confirmRes.data.success) {
            toast.success(confirmRes.data.message || confirmRes.data.data?.message || '후원이 완료되었습니다!')
            setShowSheet(false)
            setMessage('')
          } else {
            toast.error(confirmRes.data.error || '후원 처리에 실패했습니다.')
          }
        }
      } catch (err: any) {
        if (err?.code === 'USER_CANCEL') {
          toast.info('후원이 취소되었습니다.')
        } else {
          toast.error('결제 중 오류가 발생했습니다.')
          console.error('[Donation] Payment error:', err)
        }
      } finally {
        paymentContainer.remove()
      }
    } catch (err) {
      toast.error('후원에 실패했습니다.')
      console.error('[Donation] Error:', err)
    } finally {
      setProcessing(false)
    }
  }

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

          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
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

              {/* 후원 버튼 */}
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
                {processing ? '처리 중...' : `${selectedAmount.amount.toLocaleString()}원 후원하기`}
              </button>
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
