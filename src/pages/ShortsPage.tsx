import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, MessageCircle, Share2, Bookmark, ShoppingCart, X, Volume2, VolumeX, Play, ChevronUp } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { boutiqueCTA } from '@/components/glass/glassTokens'
import { formatNumber } from '@/utils/format'

interface ShortItem {
  id: number | string
  title: string
  youtube_video_id?: string
  video_url?: string
  seller_name?: string
  seller_avatar?: string
  seller_id?: number
  view_count?: number
  like_count?: number
  product_name?: string
  product_price?: number
  product_original_price?: number
  product_discount_rate?: number
  product_image?: string
  product_id?: number
  source_type?: string
  live_stream_id?: number
  viewer_count?: number
}

// YTPlayer에 mute/isMuted 추가 (쇼츠 전용)
interface ShortsYTPlayer {
  playVideo(): void
  pauseVideo(): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  destroy(): void
}

export default function ShortsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [shorts, setShorts] = useState<ShortItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRefs = useRef<Map<string, ShortsYTPlayer>>(new Map())
  const seenIds = useRef<Set<string>>(new Set())

  // 초기 로드
  useEffect(() => {
    loadFeed()
  }, [])

  async function loadFeed() {
    try {
      const exclude = Array.from(seenIds.current).join(',')
      const res = await api.get(`/api/shorts/feed?limit=5&exclude=${exclude}`)
      if (res.data.success && res.data.data.length > 0) {
        const newItems = res.data.data as ShortItem[]
        newItems.forEach(item => seenIds.current.add(String(item.id)))
        setShorts(prev => [...prev, ...newItems])
      }
    } catch {
      // 쇼츠 API 실패 시 라이브 다시보기로 폴백
    } finally {
      setLoading(false)
    }
  }

  // 스크롤 감지 (snap 기반)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'))
            setActiveIndex(idx)

            // 조회수 증가
            const item = shorts[idx]
            if (item && typeof item.id === 'number') {
              api.post(`/api/shorts/${item.id}/view`).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
            }

            // 끝에 가까우면 더 로드
            if (idx >= shorts.length - 2) {
              loadFeed()
            }
          }
        })
      },
      { root: container, threshold: 0.6 }
    )

    container.querySelectorAll('[data-index]').forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [shorts])

  // YouTube 플레이어 초기화
  const initPlayer = useCallback((videoId: string, elementId: string, index: number) => {
    if (playerRefs.current.has(elementId)) return
    // @ts-ignore
    if (!window.YT?.Player) return

    try {
      // @ts-ignore
      const player = new window.YT.Player(elementId, {
        videoId,
        playerVars: {
          autoplay: index === 0 ? 1 : 0,
          mute: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: videoId,
          fs: 0,
          showinfo: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            playerRefs.current.set(elementId, player as unknown as ShortsYTPlayer)
          },
        },
      })
    } catch { /* ignore */ }
  }, [])

  // 활성 영상 재생, 나머지 정지
  useEffect(() => {
    playerRefs.current.forEach((player, key) => {
      try {
        if (key === `shorts-player-${activeIndex}`) {
          player.playVideo()
          if (!muted) player.unMute()
          else player.mute()
        } else {
          player.pauseVideo()
        }
      } catch { /* ignore */ }
    })
  }, [activeIndex, muted])

  // 메모리 누수 방지: 활성 인덱스 기준 ±2 범위 밖 플레이어 파괴
  useEffect(() => {
    playerRefs.current.forEach((player, key) => {
      // key format: `shorts-player-${index}`
      const match = key.match(/shorts-player-(\d+)/)
      if (!match) return
      const idx = Number(match[1])
      if (Math.abs(idx - activeIndex) > 2) {
        try { player.destroy?.() } catch { /* ignore */ }
        playerRefs.current.delete(key)
      }
    })
  }, [activeIndex])

  // 언마운트 시 모든 플레이어 파괴
  useEffect(() => {
    return () => {
      playerRefs.current.forEach(p => {
        try { p.destroy?.() } catch { /* ignore */ }
      })
      playerRefs.current.clear()
    }
  }, [])

  // 좋아요 토글
  async function handleLike(item: ShortItem) {
    if (typeof item.id !== 'number') return
    try {
      const res = await api.post(`/api/shorts/${item.id}/like`)
      if (res.data.success) {
        setShorts(prev => prev.map(s =>
          s.id === item.id
            ? { ...s, like_count: (s.like_count || 0) + (res.data.data.liked ? 1 : -1) }
            : s
        ))
      }
    } catch {
      toast.error(t('common.loginRequired'))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
    }
  }

  // Extract hashtags from title
  function extractHashtags(title: string): string[] {
    const tags = title.match(/#[\w가-힣]+/g)
    return tags ? tags.slice(0, 4) : ['#쇼츠', '#유어딜']
  }

  // Get next shorts thumbnails for the strip
  function getNextThumbnails(currentIndex: number): ShortItem[] {
    return shorts.slice(currentIndex + 1, currentIndex + 4)
  }

  if (loading && shorts.length === 0) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (shorts.length === 0) {
    return (
      <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white">
        <Play className="w-12 h-12 text-gray-500 mb-3" />
        <p className="text-lg font-bold">{t('shorts.empty')}</p>
        <p className="text-sm text-gray-500 mt-1">{t('shorts.emptySub')}</p>
        <button onClick={() => navigate('/')} className="mt-4 px-5 py-2 bg-white/10 rounded-full text-sm">홈으로</button>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black">
      <SEO title="쇼츠 - 유어딜" description="유어딜 쇼츠에서 인기 상품 숏폼 영상을 감상하세요." url="/shorts" />

      {/* 세로 스와이프 컨테이너 */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {shorts.map((item, index) => {
          const nextThumbs = getNextThumbnails(index)
          const remainingCount = Math.max(0, shorts.length - index - 1 - nextThumbs.length)
          const hashtags = extractHashtags(item.title)
          const discountRate = item.product_discount_rate || 0
          const originalPrice = item.product_original_price || item.product_price || 0
          const finalPrice = item.product_price || 0

          return (
            <div
              key={item.id}
              data-index={index}
              className="h-full w-full snap-start snap-always relative"
            >
              {/* 영상 배경 */}
              {item.youtube_video_id ? (
                <div className="absolute inset-0">
                  <div
                    id={`shorts-player-${index}`}
                    className="w-full h-full [&_iframe]:!absolute [&_iframe]:!top-1/2 [&_iframe]:!left-1/2 [&_iframe]:!-translate-x-1/2 [&_iframe]:!-translate-y-1/2 [&_iframe]:!h-full [&_iframe]:!w-auto [&_iframe]:!min-w-full [&_iframe]:!aspect-video"
                    ref={() => {
                      // @ts-ignore
                      if (window.YT?.Player) {
                        setTimeout(() => initPlayer(item.youtube_video_id!, `shorts-player-${index}`, index), 100)
                      } else {
                        // @ts-ignore
                        if (!window.youtubeCallbacks) window.youtubeCallbacks = []
                        // @ts-ignore
                        window.youtubeCallbacks.push(() => initPlayer(item.youtube_video_id!, `shorts-player-${index}`, index))
                      }
                    }}
                  />
                  {/* 썸네일 배경 (플레이어 로드 전) */}
                  <img
                    src={`https://img.youtube.com/vi/${item.youtube_video_id}/maxresdefault.jpg`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover -z-10"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${item.youtube_video_id}/hqdefault.jpg` }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
              )}

              {/* 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-40% to-black/70 pointer-events-none" />

              {/* === TOP BAR === */}
              <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-safe pb-2">
                {/* Seller info pill */}
                <button
                  onClick={() => item.seller_id && navigate(`/s/${item.seller_id}`)}
                  className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full pl-1 pr-3.5 py-1"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                    {item.seller_avatar ? (
                      <img src={item.seller_avatar} alt={`${item.seller_name || '셀러'} 프로필 이미지`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="text-[10px] font-bold text-white">{(item.seller_name || '?').charAt(0)}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-[12px] font-bold leading-tight">{item.seller_name || '셀러'}</p>
                    <p className="text-white/60 text-[10px] leading-tight">{item.view_count || 0} 조회</p>
                  </div>
                </button>

                {/* Right: follow + mute + close */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => item.seller_id ? navigate(`/s/${item.seller_id}`) : toast.info(t('common.comingSoon'))}
                    className="px-3.5 py-1.5 bg-white rounded-full text-[11px] font-bold text-gray-900 active:scale-95 transition-transform"
                  >
                    팔로우
                  </button>
                  <button onClick={() => setMuted(!muted)} aria-label={muted ? '음소거 해제' : '음소거'} className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                    {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <button onClick={() => navigate(-1)} aria-label="닫기" className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* === LEFT THUMBNAIL STRIP === */}
              {nextThumbs.length > 0 && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
                  {nextThumbs.map((thumb, i) => (
                    <div
                      key={`thumb-${thumb.id}-${i}`}
                      className="w-12 h-16 rounded-xl overflow-hidden border-2 border-white/30 opacity-70"
                    >
                      {thumb.youtube_video_id ? (
                        <img
                          src={`https://img.youtube.com/vi/${thumb.youtube_video_id}/default.jpg`}
                          alt=""
                          className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div className="w-12 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">+{remainingCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* === RIGHT ACTION RAIL === */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
                {/* Like */}
                <button onClick={() => handleLike(item)} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white font-medium">{item.like_count || 0}</span>
                </button>

                {/* Comment */}
                <button onClick={() => toast.info(t('common.comingSoon'))} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white font-medium">댓글</span>
                </button>

                {/* Share (Kakao) */}
                <KakaoShareButton
                  title={item.title}
                  description={item.seller_name ? `${item.seller_name}의 영상` : '유어딜 쇼츠'}
                  link={typeof item.id === 'number' ? `/shorts/${item.id}` : `/live/${item.live_stream_id}`}
                  compact
                  className="flex flex-col items-center gap-1"
                />

                {/* Wishlist */}
                <button onClick={() => toast.info(t('common.comingSoon'))} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white font-medium">저장</span>
                </button>
              </div>

              {/* === TITLE + HASHTAGS (below center) === */}
              <div className="absolute bottom-56 left-0 right-16 px-4 z-20">
                {/* 실시간 라이브 배지 */}
                {item.source_type === 'live' && (
                  <button
                    onClick={() => item.live_stream_id && navigate(`/live/${item.live_stream_id}`)}
                    className="flex items-center gap-2 mb-3 bg-red-500/90 backdrop-blur-sm rounded-xl px-4 py-2.5 w-full active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-white">LIVE</span>
                    </div>
                    <span className="text-xs text-white/80 flex-1 text-left">{t('shorts.toLive')}</span>
                    {item.viewer_count != null && item.viewer_count > 0 && (
                      <span className="text-[10px] text-white/70">{item.viewer_count}명 시청</span>
                    )}
                  </button>
                )}

                {/* Title */}
                <p className="text-white text-[15px] font-semibold leading-snug line-clamp-2 mb-2.5 drop-shadow-lg">
                  {item.title}
                </p>

                {/* Hashtag pills */}
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-white/[0.18] backdrop-blur-sm text-white text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 라이브 다시보기 */}
                {item.source_type === 'live_replay' && (
                  <button
                    onClick={() => item.live_stream_id && navigate(`/live/${item.live_stream_id}`)}
                    className="mt-2 text-xs text-red-400 font-medium"
                  >
                    라이브 다시보기로 이동 →
                  </button>
                )}
              </div>

              {/* === PRODUCT CARD (bottom) — v4 Boutique 톤 === */}
              {item.product_id && item.product_name && (
                <div className="absolute bottom-14 left-3 right-3 z-20 animate-[slideUp_0.4s_ease-out]">
                  <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                    {/* Label strip — Boutique: 옅은 그라데이션 배경 + 빨강 텍스트 */}
                    <div className="flex items-center justify-between px-4 py-2"
                      style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(236,72,153,0.08))' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', letterSpacing: '0.08em' }}>FEATURED PRODUCT</span>
                      <span style={{ fontSize: 10, color: '#6B7280' }}>{t('shorts.featuredProduct')}</span>
                    </div>

                    {/* Main row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="relative rounded-2xl overflow-hidden shrink-0 cursor-pointer"
                        style={{ width: 72, height: 72 }}
                        onClick={() => navigate(`/products/${item.product_id}`)}>
                        {item.product_image ? (
                          <img src={item.product_image} alt={item.product_name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        {discountRate > 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded"
                            style={{ background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 800 }}>-{discountRate}%</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', lineHeight: 1.4 }} className="line-clamp-2">{item.product_name}</p>
                        {originalPrice > finalPrice && (
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{formatNumber(originalPrice)}</span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1">
                          {discountRate > 0 && <span style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>{discountRate}%</span>}
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{formatNumber(finalPrice)}</span>
                          <span style={{ fontSize: 11, color: '#6B7280' }}>원</span>
                        </div>
                      </div>
                    </div>

                    {/* Action row — 3분할 (찜 / 장바구니 / 바로구매) */}
                    <div className="grid grid-cols-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!item.product_id) return
                          api.post('/api/wishlists', { product_id: item.product_id })
                            .then(() => toast.success(t('common.wishlistAdded')))
                            .catch(() => toast.error('로그인이 필요합니다'))
                        }}
                        className="py-3 flex flex-col items-center gap-0.5"
                        style={{ borderRight: '1px solid #F3F4F6' }}
                        aria-label="찜하기"
                      >
                        <Heart style={{ width: 16, height: 16, color: '#6B7280' }} />
                        <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>찜하기</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          api.post('/api/cart', { product_id: item.product_id, quantity: 1 })
                            .then(() => toast.success(t('cart.itemAdded')))
                            .catch(() => {
                              toast.error(t('common.loginRequired'))
                              localStorage.setItem('loginReturnUrl', window.location.pathname)
                              navigate('/login')
                            })
                        }}
                        className="py-3 flex flex-col items-center gap-0.5"
                        style={{ borderRight: '1px solid #F3F4F6' }}
                        aria-label="장바구니에 담기"
                      >
                        <ShoppingCart style={{ width: 16, height: 16, color: '#6B7280' }} />
                        <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>장바구니</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/products/${item.product_id}`)
                        }}
                        className="py-3 flex flex-col items-center gap-0.5 active:opacity-90"
                        style={boutiqueCTA}
                        aria-label="바로구매"
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>바로구매</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>무료배송</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* === SWIPE HINT === */}
              <div className="absolute bottom-3 left-0 right-0 z-20 flex flex-col items-center gap-1">
                <ChevronUp className="w-4 h-4 text-white/50 animate-bounce" />
                <span className="text-[11px] text-white/40 font-medium">{t('shorts.swipeNext')}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
