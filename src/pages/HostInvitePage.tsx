/**
 * 🛡️ 2026-05-25 (migration 0280): 호스트 초대 링크 진입.
 *
 * /g/:invite_code (public)
 *
 * 친구가 카톡으로 받은 링크 → 호스트 정보 + 상품 + "참여" 버튼.
 * 참여 클릭 → ?ref={host_user_id} 부착 후 상품 페이지로 이동.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { hostingApi, type InviteView } from '@/features/hosting/api/hosting-api'
import { formatWon, formatNumber } from '@/utils/format'

export default function HostInvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { invite_code = '' } = useParams<{ invite_code: string }>()
  const [data, setData] = useState<InviteView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invite_code) return
    let alive = true
    hostingApi.viewInvite(invite_code)
      .then(res => {
        if (!alive) return
        if (res.success) setData(res.host)
        else setError(res.error || '초대를 찾을 수 없습니다')
      })
      .catch(() => alive && setError('초대를 찾을 수 없습니다'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [invite_code])

  function handleJoin() {
    if (!data) return
    // ref 부착 → ProductDetailPage 가 affiliate_ref 자동 저장 (기존 흐름)
    navigate(`/products/${data.product_id}?ref=${data.host_user_id}&from=invite&code=${data.invite_code}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center px-4 text-center">
        <p className="text-5xl mb-3">😢</p>
        <p className="text-base mb-2">{error}</p>
        <Link to="/" className="mt-4 px-6 py-3 bg-pink-500 rounded-xl font-bold">홈으로</Link>
      </div>
    )
  }

  const isActive = data.status === 'active'
  const progress = Math.min(100, (data.current_quantity / Math.max(1, data.target_quantity)) * 100)

  return (
    <>
      <SEO
        title={`${data.host_name} 의 공구 초대 — ${data.product_name}`}
        description={data.note || `${data.host_name} 님이 공구를 모집 중이에요`}
        url={`/g/${data.invite_code}`}
      />
      <div className="min-h-screen bg-[#020202] text-white pb-24">
        {/* 호스트 헤더 */}
        <header className="px-4 pt-8 pb-6 text-center">
          {data.host_profile ? (
            <img src={data.host_profile} alt={data.host_name} className="w-16 h-16 rounded-full object-cover mx-auto mb-2 bg-[#1A1A1A]" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center text-2xl font-bold text-pink-400 mx-auto mb-2">
              {(data.host_name || '?').slice(0, 1)}
            </div>
          )}
          <p className="text-xs text-gray-400">@{data.host_handle}</p>
          <p className="text-base font-bold">{data.host_name} 님이 초대했어요</p>
          {data.note && <p className="text-sm text-gray-300 mt-2 px-6">💬 {data.note}</p>}
        </header>

        {/* 상품 카드 */}
        <div className="max-w-md mx-auto px-4">
          <div className="bg-[#0A0A0A] rounded-2xl border border-[#1A1A1A] overflow-hidden">
            {(data.thumbnail || data.image_url) && (
              <div className="aspect-video bg-[#121212]">
                <img src={data.thumbnail || data.image_url || ''} alt={data.product_name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <p className="text-base font-bold mb-2">{data.product_name}</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-pink-400">{formatWon(data.price)}</span>
                {data.original_price && data.original_price > data.price && (
                  <span className="text-sm text-gray-500 line-through">{formatWon(data.original_price)}</span>
                )}
              </div>

              {/* 진행 상황 */}
              <div className="bg-[#121212] rounded-xl p-3 mb-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">모집 현황</span>
                  <span className="font-bold">
                    {formatNumber(data.current_quantity)}/{formatNumber(data.target_quantity)}명
                  </span>
                </div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* CTA */}
              {isActive ? (
                <button
                  onClick={handleJoin}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white text-base font-bold rounded-xl"
                >
                  🎉 공구 참여하기
                </button>
              ) : (
                <div className="w-full py-3 bg-[#1A1A1A] text-gray-500 text-center text-base font-bold rounded-xl">
                  {data.status === 'achieved' ? '🎉 달성 완료' : '⏰ 마감되었어요'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
