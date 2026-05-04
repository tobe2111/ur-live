/**
 * 🛡️ 2026-04-28: 선물 받기 페이지
 *
 * URL: /gift/claim/:token
 * 동작:
 *   - token 으로 선물 정보 조회 (인증 불필요)
 *   - 만료/이미 받음 시 안내
 *   - 새 받기: 주소 입력 폼 (postal/address/detail/phone)
 *   - 받기 완료 → 셀러가 발송 시 추가 알림
 *
 * 화이트 테마 (쇼핑/결제 페이지) — text-gray-900 dark:text-white 등
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { Gift, Loader2, CheckCircle2, XCircle, MapPin, Phone, Sparkles } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface GiftInfo {
  id: number
  product_id: number
  product_name: string
  product_thumbnail: string | null
  amount: number
  message: string | null
  status: 'pending' | 'paid' | 'claimed' | 'shipped' | 'delivered' | 'expired' | 'refunded'
  recipient_name: string | null
  sender_name: string
  expires_at: string
  created_at: string
}

export default function GiftClaimPage() {
  const { t, i18n } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [gift, setGift] = useState<GiftInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 폼
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.get(`/api/gifts/claim/${token}`)
      .then(r => setGift(r.data?.data || null))
      .catch(() => setGift(null))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (address.trim().length < 5) {
      toast.error(t('giftClaim.errorAddressInvalid'))
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/api/gifts/claim/${token}`, {
        address: address.trim(),
        address_detail: addressDetail.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      toast.success(t('giftClaim.successClaimed'))
      // 새로고침해서 상태 업데이트
      const r = await api.get(`/api/gifts/claim/${token}`)
      setGift(r.data?.data || null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('giftClaim.errorClaimFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  if (!gift) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center px-6">
        <SEO title={t('giftClaim.notFoundSeoTitle')} description={t('giftClaim.notFoundSeoDesc')} url={`/gift/claim/${token}`} />
        <div className="text-center max-w-sm">
          <XCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('giftClaim.notFoundTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('giftClaim.notFoundDesc')}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-pink-500 text-white rounded-full text-sm font-bold">
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  const isExpired = gift.status === 'expired'
  const isClaimed = ['claimed', 'shipped', 'delivered'].includes(gift.status)
  const isPending = gift.status === 'pending'  // 결제 안 끝남
  const canClaim = gift.status === 'paid'

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <SEO
        title={`${gift.sender_name}님이 선물을 보냈어요 - 유어딜`}
        description={`${gift.product_name} 선물을 확인해보세요`}
        url={`/gift/claim/${token}`}
      />

      <div className="ur-content-narrow px-5 lg:px-8 py-10">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 mb-3">
            <Gift className="w-8 h-8 text-pink-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            <Trans
              i18nKey="giftClaim.fromSender"
              values={{ name: gift.sender_name }}
              components={[<span key="0" className="text-pink-500" />, <br key="1" />]}
            />
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{new Date(gift.created_at).toLocaleDateString(i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US')}</p>
        </div>

        {/* 상품 카드 */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-5 shadow-sm mb-4">
          <div className="flex gap-3 mb-4">
            {gift.product_thumbnail ? (
              <img src={gift.product_thumbnail} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                <Gift className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-white text-sm leading-tight mb-2">{gift.product_name}</h2>
              <div className="text-pink-500 font-bold text-base">{formatNumber(gift.amount)}원</div>
            </div>
          </div>

          {gift.message && (
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-100 dark:border-pink-800/40">
              <div className="flex items-center gap-1 text-xs font-bold text-pink-600 mb-2">
                <Sparkles className="w-3 h-3" /> {t('giftClaim.messageLabel')}
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{gift.message}</p>
            </div>
          )}
        </div>

        {/* 상태별 액션 */}
        {isExpired && (
          <div className="bg-gray-50 dark:bg-[#121212] rounded-2xl p-5 text-center">
            <XCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('giftClaim.expiredTitle')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('giftClaim.expiredHint')}</p>
          </div>
        )}

        {isPending && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-5 text-center border border-yellow-100 dark:border-yellow-800/40">
            <Loader2 className="w-6 h-6 text-yellow-600 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-semibold text-yellow-800">{t('giftClaim.pendingTitle')}</p>
            <p className="text-xs text-yellow-700 mt-1">{t('giftClaim.pendingHint')}</p>
          </div>
        )}

        {isClaimed && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 text-center border border-green-100 dark:border-green-800/40">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-700">
              {gift.status === 'claimed' && t('giftClaim.statusClaimed')}
              {gift.status === 'shipped' && t('giftClaim.statusShipped')}
              {gift.status === 'delivered' && t('giftClaim.statusDelivered')}
            </p>
          </div>
        )}

        {canClaim && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-pink-500" /> {t('giftClaim.addressTitle')}
            </h3>
            <div className="space-y-3">
              <input
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                placeholder={t('giftClaim.postalCode')}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white dark:focus:bg-[#0A0A0A]"
              />
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={t('giftClaim.addressMain')}
                required
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white dark:focus:bg-[#0A0A0A]"
              />
              <input
                value={addressDetail}
                onChange={e => setAddressDetail(e.target.value)}
                placeholder={t('giftClaim.addressDetail')}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white dark:focus:bg-[#0A0A0A]"
              />
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('giftClaim.phone')}
                  type="tel"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white dark:focus:bg-[#0A0A0A]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !address.trim()}
              className="w-full mt-5 py-4 bg-pink-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              {t('giftClaim.submit')}
            </button>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-3">
              {t('giftClaim.expiresAt', { date: new Date(gift.expires_at).toLocaleDateString(i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US') })}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
