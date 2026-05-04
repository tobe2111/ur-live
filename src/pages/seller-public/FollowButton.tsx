/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerPublicPage 팔로우 토글 버튼.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

export default function FollowButton({ sellerId }: { sellerId: string }) {
  const { t } = useTranslation()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get(`/api/social/follow/${sellerId}`).then(r => {
      if (r.data.success) setFollowing(r.data.data.following)
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [sellerId])

  return (
    <button
      onClick={async () => {
        setLoading(true)
        try {
          const res = await api.post(`/api/social/follow/${sellerId}`)
          if (res.data.success) setFollowing(res.data.data.following)
        } catch { /* 로그인 필요 */ }
        finally { setLoading(false) }
      }}
      disabled={loading}
      className={`w-full py-3 rounded-xl text-sm font-bold mt-4 transition-all active:scale-[0.98] ${
        following
          ? 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2A2A2A]'
          : 'bg-pink-500 text-white'
      }`}
    >
      {following ? t('seller.publicPage.following') : t('seller.publicPage.follow')}
    </button>
  )
}
