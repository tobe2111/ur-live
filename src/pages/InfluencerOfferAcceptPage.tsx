/**
 * 📣 인플루언서 제안 수락 페이지 — /i/offer/:token (발송 메일/DM 속 링크의 착지)
 *   제안 내용(매장·이용권·커미션%) 보여주고, 카카오 로그인 → 수락 → 전용 홍보 링크 발급.
 *   noindex(초대장 — 검색 노출 대상 아님).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'

interface Offer {
  seller_name: string; product_name: string | null; product_price: number | null; product_image: string | null
  commission_pct: number; product_support: string; channels: string; message: string | null; status: string
}

export default function InfluencerOfferAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get(`/api/influencer-offers/${token}`)
      .then((r) => setOffer(r.data?.data || null))
      .catch((e) => setError(e?.response?.data?.error || '제안을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [token])

  const accept = () => {
    if (!token || accepting) return
    setAccepting(true)
    api.post(`/api/influencer-offers/${token}/accept`)
      .then((r) => setTrackingUrl(r.data?.data?.tracking_url || null))
      .catch((e) => {
        const status = e?.response?.status
        if (status === 401) {
          // 로그인 필요 — 카카오 로그인 후 이 페이지로 복귀
          window.location.href = `/login?returnUrl=${encodeURIComponent(`/i/offer/${token}`)}`
          return
        }
        setError(e?.response?.data?.error || '수락 중 오류가 발생했어요')
      })
      .finally(() => setAccepting(false))
  }

  if (loading) return <BrandLoader fullScreen />

  const channels = (() => { try { return (JSON.parse(offer?.channels || '[]') as string[]).join(' · ') } catch { return '' } })()

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A] flex items-center justify-center p-5">
      <Helmet><meta name="robots" content="noindex, nofollow" /><title>협업 제안 - 유어딜</title></Helmet>
      <div className="w-full max-w-md">
        {error && !offer ? (
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">제안을 열 수 없어요</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        ) : trackingUrl ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">제안을 수락했어요!</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              아래 <strong>내 전용 링크</strong>로 팔로워가 구매하면, 이용권이 <strong>사용될 때</strong> 커미션이 적립돼요.
            </p>
            <div className="bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-900 dark:text-white break-all">
              {trackingUrl}
            </div>
            <button
              className="w-full py-3 rounded-xl bg-brand text-white font-semibold"
              onClick={() => { navigator.clipboard?.writeText(trackingUrl).then(() => setCopied(true)).catch(() => {}) }}
            >{copied ? '복사됐어요 ✓' : '링크 복사하기'}</button>
            <p className="text-xs text-gray-500 dark:text-gray-400">내 유어샵(마이 → 유어샵)에 핀해서 함께 홍보할 수도 있어요.</p>
          </div>
        ) : offer ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">유어딜 협업 제안</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{offer.seller_name}</h1>
            </div>
            {offer.product_name && (
              <div className="bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{offer.product_name}</p>
                {offer.product_price != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">판매가 {Number(offer.product_price).toLocaleString()}원</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">판매 커미션</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{offer.commission_pct}%</p>
              </div>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">상품 제공</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{offer.product_support === 'free' ? '무상' : '유상'}</p>
              </div>
            </div>
            {channels && <p className="text-xs text-center text-gray-500 dark:text-gray-400">진행 매체: {channels}</p>}
            {offer.message && (
              <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-[#121212] rounded-xl p-4 max-h-48 overflow-y-auto">
                {offer.message}
              </div>
            )}
            {offer.status !== 'pending' ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">이미 처리된 제안이에요.</p>
            ) : (
              <button
                className="w-full py-3 rounded-xl bg-brand text-white font-semibold disabled:opacity-50"
                disabled={accepting}
                onClick={accept}
              >{accepting ? '처리 중…' : '카카오 로그인하고 수락하기'}</button>
            )}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </div>
        ) : null}
      </div>
    </div>
  )
}
