import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ShoppingBag, ChevronLeft, Volume2, VolumeX, Play } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

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
  product_image?: string
  product_id?: number
  source_type?: string
  live_stream_id?: number
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
              api.post(`/api/shorts/${item.id}/view`).catch(() => {})
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
      toast.error('로그인이 필요합니다')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
    }
  }

  if (loading && shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
        <Play className="w-12 h-12 text-gray-500 mb-3" />
        <p className="text-lg font-bold">아직 쇼츠가 없습니다</p>
        <p className="text-sm text-gray-500 mt-1">셀러들의 쇼츠를 기다려주세요</p>
        <button onClick={() => navigate('/')} className="mt-4 px-5 py-2 bg-white/10 rounded-full text-sm">홈으로</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black">
      <SEO title="쇼츠 - 유어딜" description="유어딜 쇼츠에서 인기 상품 숏폼 영상을 감상하세요." url="/shorts" />
      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-safe pb-2">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <span className="text-white font-bold text-lg">쇼츠</span>
        <button onClick={() => setMuted(!muted)} className="p-2">
          {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* 세로 스와이프 컨테이너 */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {shorts.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
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
                />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
            )}

            {/* 그라데이션 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

            {/* 우측 액션 버튼 */}
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
              {/* 좋아요 */}
              <button onClick={() => handleLike(item)} className="flex flex-col items-center">
                <Heart className="w-7 h-7 text-white" />
                <span className="text-[10px] text-white mt-1">{item.like_count || 0}</span>
              </button>
              {/* 카카오 공유 */}
              <KakaoShareButton
                title={item.title}
                description={item.seller_name ? `${item.seller_name}의 영상` : '유어딜 쇼츠'}
                link={typeof item.id === 'number' ? `/shorts/${item.id}` : `/live/${item.live_stream_id}`}
                compact
                className="flex flex-col items-center"
              />
            </div>

            {/* 하단 정보 */}
            <div className="absolute bottom-6 left-0 right-16 px-4 z-20">
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
                  <span className="text-xs text-white/80 flex-1 text-left">라이브 방송 입장하기</span>
                  {(item as any).viewer_count > 0 && (
                    <span className="text-[10px] text-white/70">{(item as any).viewer_count}명 시청</span>
                  )}
                </button>
              )}

              {/* 셀러 정보 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  {item.seller_avatar ? (
                    <img src={item.seller_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{(item.seller_name || '?').charAt(0)}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-white">{item.seller_name || '셀러'}</span>
                {item.source_type === 'live' && (
                  <span className="ml-auto text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">LIVE</span>
                )}
              </div>

              {/* 제목 */}
              <p className="text-white text-sm font-medium leading-tight line-clamp-2 mb-2">
                {item.title}
              </p>

              {/* 연결 상품 */}
              {item.product_name && (
                <button
                  onClick={() => item.product_id && navigate(`/products/${item.product_id}`)}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10"
                >
                  {item.product_image && (
                    <img src={item.product_image} alt="" className="w-8 h-8 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[11px] text-white/80 truncate">{item.product_name}</p>
                    {item.product_price && (
                      <p className="text-[12px] font-bold text-white">{item.product_price.toLocaleString()}원</p>
                    )}
                  </div>
                  <ShoppingBag className="w-4 h-4 text-white/60 shrink-0" />
                </button>
              )}

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
          </div>
        ))}
      </div>
    </div>
  )
}
