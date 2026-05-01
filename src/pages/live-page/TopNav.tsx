/**
 * 🛡️ 2026-05-01: TD-018 분할 — LivePageV2 상단 네비게이션 (셀러/팔로우/시청자/SNS).
 *
 * v4 Glass · Boutique 톤 (2026-04-29)
 *   디자인: seller pill (dark glass) + 팔로우 흰 pill + LIVE 빨강 둥근 칩 + 시청자 glass chip
 *   결정: Q7=뒤로가기 유지(ChevronLeft) / Q8=팔로워 수 표시 안 함
 */
import { useEffect, useState } from 'react'
import { ChevronLeft, Eye } from 'lucide-react'
import api from '@/lib/api'
import { glass } from '@/components/glass/glassTokens'
import { formatViewers } from '@/components/live/LiveUtils'
import { YouTubeIcon, InstagramIcon } from './icons'

export default function TopNav({ viewers, sellerLinks, sellerName, sellerAvatar, sellerId }: {
  viewers: number; sellerLinks?: { youtube?: string; instagram?: string; kakao?: string }
  sellerName?: string; sellerAvatar?: string; sellerId?: number
}) {
  const [following, setFollowing] = useState(false)
  const handleFollow = async () => {
    if (!sellerId) return
    try {
      await api.post(`/api/social/follow/${sellerId}`)
      setFollowing(f => !f)
    } catch {}
  }
  useEffect(() => {
    if (!sellerId) return
    api.get(`/api/social/follow/${sellerId}`).then(r => {
      if (r.data.success) setFollowing(r.data.data?.following || false)
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [sellerId])

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-2 pt-safe pb-1.5">
      <div className="flex items-center justify-between gap-1.5">
        {/* 좌측: 뒤로가기 (Q7 = 유지) */}
        <a href="/" aria-label="홈으로 돌아가기"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={glass.navPill}>
          <ChevronLeft className="h-5 w-5 text-white/80" />
        </a>

        {/* 중앙: 셀러 pill (Boutique 톤 — gradient avatar + 셀러명) */}
        {sellerName && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 rounded-full pl-1 pr-2 py-1"
            style={glass.navPill}>
            {sellerAvatar ? (
              <img src={sellerAvatar} alt={`${sellerName} 프로필 이미지`}
                className="rounded-full object-cover shrink-0"
                style={{ width: 24, height: 24 }} loading="lazy" decoding="async" />
            ) : (
              <div className="rounded-full flex items-center justify-center shrink-0 text-white"
                style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #EF4444, #EC4899)', fontSize: 11, fontWeight: 800 }}>
                {sellerName.charAt(0)}
              </div>
            )}
            <span className="truncate text-white" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{sellerName}</span>
          </div>
        )}

        {/* 우측: 팔로우 흰 pill + LIVE 둥근 칩 + 시청자 glass chip + SNS */}
        {/* 🛡️ 2026-04-30: 화면 밖 넘침 방지 — gap/padding 축소 */}
        <div className="flex items-center gap-1 shrink-0">
          {sellerId && (
            <button onClick={handleFollow}
              aria-label={following ? '팔로우 취소' : '팔로우하기'}
              className="rounded-full px-2.5 py-1.5 transition-colors"
              style={{
                background: following ? 'rgba(255,255,255,0.18)' : '#fff',
                color: following ? 'rgba(255,255,255,0.9)' : '#000',
                fontSize: 11, fontWeight: 800,
              }}>
              {following ? 'Following' : '팔로우'}
            </button>
          )}
          <div className="inline-flex items-center gap-1 rounded-full"
            style={{ padding: '5px 8px 5px 7px', background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <span className="rounded-full" style={{ width: 5, height: 5, background: '#fff', boxShadow: '0 0 6px #fff' }} />
            <span className="text-white" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>LIVE</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full px-2 py-1"
            style={glass.statsChip}>
            <Eye className="h-3 w-3 text-white/85" />
            <span className="text-white" style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatViewers(viewers)}</span>
          </div>
          {sellerLinks?.youtube && (
            <a href={sellerLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="유튜브 채널 방문"
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={glass.actionRail}>
              <YouTubeIcon className="h-3.5 w-3.5 text-white/85" />
            </a>
          )}
          {sellerLinks?.instagram && (
            <a href={sellerLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="인스타그램 방문"
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={glass.actionRail}>
              <InstagramIcon className="h-3.5 w-3.5 text-white/85" />
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
