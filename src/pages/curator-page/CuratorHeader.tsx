/**
 * 🛡️ 2026-05-25 (C 옵션 통합): 큐레이터 공개페이지 헤더.
 *
 * 셀러 ProfileHeader 와 비슷한 풍부함 — 큰 프로필 + 인사말 + CTA.
 * 셀러 권한 있는 user 는 /profile/{username} 으로 redirect (CuratorPage 가 처리).
 * 본 헤더는 일반 user 용 (셀러 권한 없음).
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Heart } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import { formatNumber } from '@/utils/format'

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
  }
  pinCount: number
  totalClicks: number
  isOwner: boolean
  onCopyLink: () => void
}

export default function CuratorHeader({ curator, pinCount, totalClicks, isOwner, onCopyLink }: CuratorHeaderProps) {
  const { t } = useTranslation()
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${curator.handle}` : `/u/${curator.handle}`

  return (
    <header className="bg-gradient-to-b from-[#0A0A0A] to-[#020202] border-b border-[#1A1A1A]">
      {/* 큰 프로필 영역 */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-6">
        <div className="flex items-start gap-4">
          {/* 프로필 사진 — 큼 */}
          <div className="shrink-0">
            {curator.profile_image ? (
              <img
                src={curator.profile_image}
                alt={curator.name}
                className="w-24 h-24 rounded-2xl object-cover ring-2 ring-pink-500/30 bg-[#121212]"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center text-4xl font-bold text-pink-400 ring-2 ring-pink-500/30">
                {(curator.name || '?').slice(0, 1)}
              </div>
            )}
          </div>

          {/* 이름 + 핸들 + bio */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{curator.name}</h1>
            <p className="text-sm text-pink-400 mt-0.5">@{curator.handle}</p>
            {curator.bio && (
              <p className="text-sm text-gray-300 mt-2 line-clamp-3 leading-relaxed">{curator.bio}</p>
            )}

            {/* 통계 — 핀 개수 + 누적 클릭 */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="text-gray-400">
                <strong className="text-white">{formatNumber(pinCount)}</strong> 추천
              </span>
              {totalClicks > 0 && (
                <span className="text-gray-400">
                  <strong className="text-white">{formatNumber(totalClicks)}</strong> 클릭
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CTA 버튼 — 공유 / (본인) 적립 보기 */}
        <div className="flex gap-2 mt-5">
          <div className="flex-1">
            <KakaoShareButton
              title={`${curator.name} 의 링크샵`}
              description={curator.bio || `${pinCount}개 상품 추천 중`}
              imageUrl={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
              link={`/u/${curator.handle}`}
              className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-sm font-bold transition-colors"
              buttonText="링크샵 둘러보기"
            />
          </div>
          <button
            onClick={onCopyLink}
            className="px-4 py-2.5 bg-[#121212] hover:bg-[#1A1A1A] rounded-xl text-sm font-bold text-white transition-colors"
            aria-label={t('curator.copyLink', { defaultValue: '링크 복사' })}
            title="링크 복사"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {!isOwner && (
            <button
              className="px-4 py-2.5 bg-[#121212] hover:bg-[#1A1A1A] rounded-xl text-sm font-bold text-white transition-colors"
              aria-label="좋아요"
              title="좋아요"
            >
              <Heart className="w-4 h-4" />
            </button>
          )}
          {isOwner && (
            <Link
              to="/u/me/earnings"
              className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 rounded-xl text-sm font-bold text-white text-center transition-colors"
              title="내 적립 보기"
            >
              💰
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
