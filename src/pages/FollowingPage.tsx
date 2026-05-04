/**
 * FollowingPage - 사용자가 팔로우한 셀러 목록
 *
 * 🛡️ 2026-05-03: DesktopLiveSidebar 메뉴에 '/following' 링크가 있으나 라우트 누락 → 404 사고.
 *   백엔드 GET /api/social/following 은 이미 존재 (seller_follows 테이블).
 *   페이지만 추가해 사고 해결 + 사이드바 메뉴 정상화.
 *
 * 다크 테마 (메인 사이드바 카테고리).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, UserCheck, Users } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { isLoggedInSync, requireLogin } from '@/utils/auth'

interface FollowedSeller {
  id: number
  name: string
  profile_image: string | null
  bio: string | null
}

export default function FollowingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<FollowedSeller[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedInSync()) {
      requireLogin(navigate, t('following.loginRequired', { defaultValue: '로그인이 필요합니다.' }))
      return
    }
    api.get('/api/social/following')
      .then(r => {
        if (r.data.success) setSellers(r.data.data || [])
        else setError(r.data.error || t('following.loadFailed', { defaultValue: '팔로우 목록을 불러올 수 없습니다.' }))
      })
      .catch(() => setError(t('following.loadFailed', { defaultValue: '팔로우 목록을 불러올 수 없습니다.' })))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] pb-20">
      <SEO
        title={t('following.seoTitle', { defaultValue: '팔로잉 - 유어딜' })}
        description={t('following.seoDesc', { defaultValue: '내가 팔로우한 셀러 목록' })}
        url="/following"
        noindex
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-[#020202]/90 backdrop-blur border-b border-gray-200 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-5 lg:px-8 py-3">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back', { defaultValue: '뒤로' })}
            className="text-gray-900 dark:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900 dark:text-white font-bold text-[15px]">
            {t('following.title', { defaultValue: '팔로잉' })}
          </h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-narrow px-5 lg:px-8 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-[#121212] rounded-xl p-4 animate-pulse border border-gray-200 dark:border-[#2A2A2A] flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-900 dark:text-gray-300 font-semibold text-[14px]">{error}</p>
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-20">
            <UserCheck className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-900 dark:text-gray-300 font-semibold text-[14px]">
              {t('following.empty', { defaultValue: '팔로우한 셀러가 없습니다' })}
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-[12px] mt-1">
              {t('following.emptyHint', { defaultValue: '관심 있는 셀러를 팔로우해보세요' })}
            </p>
            <button
              onClick={() => navigate('/live')}
              className="mt-5 px-5 py-2.5 bg-pink-500 text-white text-[13px] font-semibold rounded-full"
            >
              {t('following.exploreLive', { defaultValue: '라이브 둘러보기' })}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-gray-500 mb-2">
              {t('following.count', { count: sellers.length, defaultValue: '팔로우 {{count}}명' })}
            </p>
            {sellers.map(seller => (
              <button
                key={seller.id}
                onClick={() => navigate(`/profile/${seller.id}`)}
                className="w-full flex items-center gap-3 bg-gray-50 dark:bg-[#121212] rounded-xl px-4 py-3.5 border border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden flex-shrink-0">
                  {seller.profile_image ? (
                    <img
                      src={seller.profile_image}
                      alt={seller.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <UserCheck className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-[14px] font-bold truncate">{seller.name}</p>
                  {seller.bio && (
                    <p className="text-gray-500 dark:text-gray-400 text-[12px] truncate mt-0.5">{seller.bio}</p>
                  )}
                </div>
                <span className="text-pink-500 dark:text-pink-400 text-[11px] font-semibold shrink-0">
                  {t('following.followingBadge', { defaultValue: '팔로잉' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
