/**
 * LiveDonation — 라이브 딜 후원 UI
 *
 * 1. 후원 버튼 (하트 아이콘)
 * 2. 딜 잔액 표시 + 금액 선택
 * 3. 포인트 차감으로 즉시 후원 (결제 없음)
 * 4. 잔액 부족 시 충전 안내
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Heart, X, Loader2, Zap, Plus, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync as getUserId } from '@/utils/auth'
import { glass } from '@/components/glass/glassTokens'
import { formatNumber } from '@/utils/format'

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
  { amount: 500,   label: '500딜',    emoji: '🧡' },
  { amount: 1000,  label: '1,000딜',  emoji: '❤️' },
  { amount: 3000,  label: '3,000딜',  emoji: '💎' },
  { amount: 5000,  label: '5,000딜',  emoji: '👑' },
  { amount: 10000, label: '10,000딜', emoji: '🌟' },
]

export default function LiveDonation({ streamId }: LiveDonationProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(DONATION_AMOUNTS[0])
  const [message, setMessage] = useState('')
  const [processing, setProcessing] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [centerAlert, setCenterAlert] = useState<{ emoji: string; donorName: string; amount: number } | null>(null)

  // 🛡️ 2026-04-29 a11y: ESC 닫기 + Tab focus trap (processing 중엔 닫지 않음)
  useEscapeKey(() => { if (showSheet && !processing) setShowSheet(false) })
  const sheetRef = useFocusTrap<HTMLDivElement>(showSheet)

  const userId = getUserId()

  // 바텀시트 열릴 때 잔액 조회
  useEffect(() => {
    if (showSheet && userId) {
      setLoadingBalance(true)
      api.get('/api/points/balance')
        .then(res => {
          if (res.data.success) setBalance(res.data.data.balance)
        })
        .catch(() => setBalance(0))
        .finally(() => setLoadingBalance(false))
    }
  }, [showSheet, userId])

  const handleDonate = useCallback(async () => {
    if (!userId) {
      toast.error(t('common.loginRequired', { defaultValue: '로그인이 필요합니다.' }))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      window.location.href = '/login'
      return
    }

    if (balance !== null && balance < selectedAmount.amount) {
      toast.error(t('live.donationInsufficientAlert', { defaultValue: '딜이 부족합니다. 충전 후 이용해주세요.' }))
      return
    }

    setProcessing(true)
    try {
      const res = await api.post('/api/points/donate', {
        stream_id: streamId,
        amount: selectedAmount.amount,
        message: message.trim() || undefined,
      })

      if (res.data.success) {
        toast.success(res.data.message || t('live.donationSuccessMsg', { amount: formatNumber(selectedAmount.amount), defaultValue: '{{amount}}딜을 후원했습니다!' }))
        setBalance(res.data.data.balance)
        setShowSheet(false)

        // Show center-screen donation alert
        const donorName = localStorage.getItem('user_name') || t('live.donationDonorDefault', { defaultValue: '후원자' })
        setCenterAlert({
          emoji: selectedAmount.emoji,
          donorName,
          amount: selectedAmount.amount,
        })
        setTimeout(() => setCenterAlert(null), 3000)

        // Dispatch custom event for chat system message
        window.dispatchEvent(new CustomEvent('donationAlert', {
          detail: { donorName, amount: selectedAmount.amount, message: message.trim() || '' }
        }))

        setMessage('')
      } else {
        if (res.data.code === 'INSUFFICIENT_POINTS') {
          toast.error(res.data.error)
        } else {
          toast.error(res.data.error || t('live.donationFailed', { defaultValue: '후원에 실패했습니다.' }))
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || t('live.donationFailed', { defaultValue: '후원에 실패했습니다.' })
      toast.error(errMsg)
    } finally {
      setProcessing(false)
    }
  }, [userId, streamId, selectedAmount, message, balance])

  const isInsufficient = balance !== null && balance < selectedAmount.amount

  return (
    <>
      {/* 선물하기 버튼 — v4 Boutique 톤 (40x40 dark glass + 18x18 흰 아이콘) */}
      <button
        onClick={() => setShowSheet(true)}
        className="flex items-center justify-center rounded-full transition-all active:scale-90"
        style={{ width: 40, height: 40, ...glass.actionRail }}
        aria-label={t('live.donationGift', { defaultValue: '선물하기' })}
      >
        <Gift style={{ width: 18, height: 18, color: '#fff' }} />
      </button>

      {/* 후원 센터 알림 애니메이션 */}
      {centerAlert && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="animate-donation-center-alert fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-pink-500/90 to-red-500/90 backdrop-blur-xl rounded-3xl px-8 py-6 shadow-2xl border border-white/20 text-center">
            <div className="text-5xl mb-2">{centerAlert.emoji}</div>
            <p className="text-white text-lg font-bold whitespace-nowrap">
              {t('live.donationCenterAlert', { name: centerAlert.donorName, amount: formatNumber(centerAlert.amount), defaultValue: '{{name}}님이 {{amount}}딜 후원!' })}
            </p>
          </div>
        </div>
      )}

      {/* 후원 바텀시트 */}
      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={() => !processing && setShowSheet(false)}
            aria-hidden="true"
          />

          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-sheet-title"
            className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up max-h-[85dvh] overflow-y-auto"
          >
            <div className="p-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 id="donation-sheet-title" className="text-lg font-bold text-gray-900">{t('live.donationTitle', { defaultValue: '딜 후원' })}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('live.donationSubtitle', { defaultValue: '셀러에게 응원을 보내세요!' })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => !processing && setShowSheet(false)}
                  aria-label={t('common.close', { defaultValue: '닫기' })}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-600" aria-hidden="true" />
                </button>
              </div>

              {/* 잔액 표시 */}
              <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium text-gray-700">{t('live.donationMyDeal', { defaultValue: '내 딜' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  {loadingBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <span className="text-lg font-bold text-pink-600">
                      {t('live.donationBalance', { amount: formatNumber(balance ?? 0), defaultValue: '{{amount}}딜' })}
                    </span>
                  )}
                  <button
                    onClick={() => navigate('/points/charge')}
                    className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold text-pink-600 bg-white rounded-lg border border-pink-200 hover:bg-pink-50"
                  >
                    <Plus className="w-3 h-3" />{t('live.donationCharge', { defaultValue: '충전' })}
                  </button>
                </div>
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

              {/* 메시지 입력 */}
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('live.donationMsgPlaceholder', { defaultValue: '응원 메시지를 남겨보세요 (선택)' })}
                maxLength={100}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none mb-4"
                disabled={processing}
              />

              {/* 잔액 부족 안내 */}
              {isInsufficient && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-center">
                  <p className="text-xs text-amber-800">
                    {t('live.donationInsufficient', { defaultValue: '딜이 부족합니다.' })}
                  </p>
                  <button onClick={() => navigate('/points/charge')} className="mt-1 text-xs font-bold text-amber-900 underline">
                    {t('live.donationChargeNow', { defaultValue: '충전하기' })}
                  </button>
                </div>
              )}

              {/* 후원 버튼 */}
              <button
                onClick={handleDonate}
                disabled={processing || isInsufficient}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-pink-500 to-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Heart className="w-5 h-5" />
                )}
                {processing ? t('live.donationProcessing', { defaultValue: '후원 중...' }) : t('live.donationBtn', { amount: formatNumber(selectedAmount.amount), defaultValue: '{{amount}}딜 후원하기' })}
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
  const { t } = useTranslation()
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
                {t('live.donationCenterAlert', { name: d.donorName, amount: formatNumber(d.amount), defaultValue: '{{name}}님이 {{amount}}딜 후원!' })}
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
