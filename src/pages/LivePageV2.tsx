import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import ReelCard from '@/components/live/ReelCard'
import '@/utils/console-suppressor'
import TopNav from './live-page/TopNav'
import type { Stream, ReelData } from './live-page/types'

// 🛡️ 2026-05-01: TD-018 분할 — types / icons / TopNav 를 ./live-page/ 로 이동.
// HeartReaction, LiveChat, ProductListSheet, ReelCard → @/components/live/ 에 위치.

// ============================================
// Main LivePageV2 Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  useEffect(() => {
    const ref = sp.get('ref')
    if (ref) {
      localStorage.setItem('affiliate_ref', ref)
      localStorage.setItem('affiliate_ref_expires', String(Date.now() + 86400000))
      document.cookie = `affiliate_ref=${ref}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [sp])
  const [activeIndex, setActiveIndex] = useState(0)
  const [reels, setReels] = useState<ReelData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDirectLink, setIsDirectLink] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const [currentStream, setCurrentStream] = useState<Stream | null>(null)
  
  // 실시간 시청자 수
  const [viewerCount, setViewerCount] = useState<number>(0)

  // ✅ UX C12 FIX: Session fixation 취약점 제거 (URL-param → localStorage 블록 삭제).
  // 인증 세션은 /auth/kakao/*/callback 라우트에서 중앙 처리됨. 임의의 URL에서
  // login=success&userId=...&session=... 파라미터를 받아 localStorage에 저장하는
  // 블록은 공격자가 임의 세션을 주입할 수 있게 하므로 제거.
  // 혹시 이전 링크로 진입한 경우를 대비해 URL 파라미터만 정리하고 무시.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const hasLoginParams =
      urlParams.has('login') || urlParams.has('session') ||
      urlParams.has('userId') || urlParams.has('userName')
    if (hasLoginParams) {
      urlParams.delete('login')
      urlParams.delete('session')
      urlParams.delete('userId')
      urlParams.delete('userName')
      const newSearch = urlParams.toString()
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const reelRefs = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    if (observerRef.current) observerRef.current.observe(node)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setActiveIndex(index)
          }
        })
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      }
    )

    return () => observerRef.current?.disconnect()
  }, [])

  // Load reels data - MODIFIED: Check if direct link or from homepage
  useEffect(() => {
    const loadReels = async () => {
      try {
        setLoading(true)

        // Check if user came directly to this URL (not from homepage)
        const referrer = document.referrer
        const isFromHomepage = referrer.includes(window.location.origin) && 
                               (referrer.includes('/') || referrer.includes('/home'))
        const hasStreamId = !!streamId
        
        // Direct link: Show ONLY the requested stream (no scroll)
        // Homepage link: Show ALL streams (with scroll)
        const shouldShowSingleStream = hasStreamId && !isFromHomepage
        setIsDirectLink(shouldShowSingleStream)

        // Load streams (single or all based on context)
        let streams: Stream[] = []
        
        if (shouldShowSingleStream && streamId) {
          // DIRECT LINK: Load only the requested stream
          try {
            const singleStreamResponse = await api.get(`/api/streams/${streamId}`)
            
            if (singleStreamResponse.data.success && singleStreamResponse.data.data) {
              streams = [singleStreamResponse.data.data]
            }
          } catch (error) {
            if (import.meta.env.DEV) console.error('[LivePageV2] Single stream API failed:', error)
          }
        } else {
          // HOMEPAGE LINK: Load ALL active streams
          try {
            const streamsResponse = await api.get('/api/streams')
            
            if (streamsResponse.data.success && streamsResponse.data.data?.length > 0) {
              streams = streamsResponse.data.data
            }
          } catch (error) {
            if (import.meta.env.DEV) console.error('[LivePageV2] Streams API failed:', error)
            throw error
          }
        }
            
        // Set current stream from URL parameter
        if (streamId) {
          const currentStreamData = streams.find(s => s.id === parseInt(streamId))
          if (currentStreamData) {
            setCurrentStream(currentStreamData)
            document.title = `${currentStreamData.title} - 유어딜 라이브`
          }
        }

        // Create reels: ONE reel per stream (not per product)
        // ✅ current_product_id JOIN 결과(stream.current_product)를 바로 사용하여 더미 이미지 플래시 방지
        // Products 카탈로그는 ReelCard 내부에서 loadStreamProducts()로 지연 로드됨
        const reelsData: ReelData[] = []

        for (const stream of streams) {
          reelsData.push({
            stream: stream,
            product: stream.current_product || null,
          })
        }

        
        // Set initial active index based on streamId BEFORE setReels
        let initialIndex = 0
        if (streamId) {
          const foundIndex = reelsData.findIndex(r => r.stream.id === parseInt(streamId))
          if (foundIndex !== -1) {
            initialIndex = foundIndex
          }
        }
        
        setActiveIndex(initialIndex)
        setReels(reelsData)
        
        setLoading(false)
      } catch (error) {
        if (import.meta.env.DEV) console.error('[LivePageV2] Fatal error loading reels:', error)
        
        // Show error state instead of demo data
        setReels([])
        setLoading(false)
        
        // Could show an error message to user here
        // For now, just log and show empty state
      }
    }

    loadReels()
  }, [streamId])

  // Update URL and currentStream when activeIndex changes (user scrolls)
  useEffect(() => {
    if (reels.length === 0 || activeIndex < 0 || activeIndex >= reels.length) return
    
    const activeReel = reels[activeIndex]
    const activeStreamId = activeReel.stream.id
    
    // Update URL without reload
    if (window.location.pathname !== `/live/${activeStreamId}`) {
      window.history.replaceState(null, '', `/live/${activeStreamId}`)
    }
    
    // Update currentStream
    if (currentStream?.id !== activeStreamId) {
      setCurrentStream(activeReel.stream)
    }
  }, [activeIndex, reels])

  // Scroll to initial activeIndex after reels are loaded
  useEffect(() => {
    if (reels.length === 0 || !containerRef.current) return
    if (activeIndex === 0) return // Already at top, no need to scroll
    
    // Scroll to the active reel
    const targetElement = containerRef.current.children[activeIndex] as HTMLElement
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    }
  }, [reels])

  // 🔥 KV 기반 실시간 시청자 수 추적 (Session-based)
  useEffect(() => {
    if (!currentStream?.id) return

    // 세션 ID 생성 또는 가져오기
    let sessionId = sessionStorage.getItem('viewer_session_id')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('viewer_session_id', sessionId)
    }

    // 시청자 등록 (Heartbeat)
    const joinViewer = async () => {
      try {
        await api.post(`/api/streams/${currentStream.id}/viewer/join`, {}, {
          headers: { 'X-Session-ID': sessionId }
        })
      } catch (error) {
        if (import.meta.env.DEV) console.error('[LivePageV2] Failed to join viewer:', error)
      }
    }

    // 🛡️ 2026-04-22 배치 163: exponential backoff 재연결 (P0 fix)
    //   이전: 실패해도 10s 고정 interval 유지 → 네트워크 장애 시 복구 불가.
    //   개선: 연속 실패 시 backoff 10s → 20s → 40s → 80s (최대 2분),
    //   성공 시 즉시 복귀.
    let consecutiveFailures = 0
    let viewerCountTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const fetchViewerCount = async () => {
      try {
        const response = await api.get(`/api/streams/${currentStream.id}/viewer-count`)
        if (response.data.success) {
          setViewerCount(response.data.data.viewer_count)
          consecutiveFailures = 0  // 성공 시 리셋
        }
      } catch (error) {
        consecutiveFailures++
        if (import.meta.env.DEV) console.warn(`[LivePageV2] viewer count fetch failed (streak ${consecutiveFailures}):`, error)
      } finally {
        if (cancelled) return
        // backoff: 10s base × 2^min(failures, 3) = 10/20/40/80s
        const delay = 10_000 * Math.pow(2, Math.min(consecutiveFailures, 3))
        viewerCountTimer = setTimeout(fetchViewerCount, delay)
      }
    }

    // 초기 등록
    joinViewer()
    fetchViewerCount()

    // 30초마다 Heartbeat 전송 (heartbeat TTL 120초)
    const heartbeatInterval = setInterval(joinViewer, 30000)

    // 🛡️ 2026-04-23 배치 164: 페이지 이탈 시 leave beacon (P1 분석 정확도)
    //   sendBeacon 은 페이지 언로드에도 안정적으로 전송. watch_duration 계산용.
    const leaveBeacon = () => {
      try {
        const url = `/api/streams/${currentStream.id}/viewer/leave`
        const blob = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' })
        // sendBeacon 은 커스텀 헤더 불가 → body 에 세션 포함 + 쿼리스트링 보조
        navigator.sendBeacon?.(`${url}?s=${encodeURIComponent(sessionId)}`, blob)
      } catch { /* best-effort */ }
    }
    const onPageHide = () => leaveBeacon()
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)

    return () => {
      cancelled = true
      clearInterval(heartbeatInterval)
      if (viewerCountTimer) clearTimeout(viewerCountTimer)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      leaveBeacon()
    }
  }, [currentStream?.id])

  // ✅ 로딩 중 표시
  if (loading) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Outer spinning ring */}
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            {/* Inner pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-white text-xl font-bold">라이브 입장 중...</div>
          <div className="text-white/60 text-sm">잠시만 기다려주세요</div>
        </div>
      </div>
    )
  }

  // ✅ 데이터 없음 표시
  if (reels.length === 0) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-2">진행 중인 라이브가 없습니다</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // ✅ activeIndex가 유효한 범위인지 확인
  const currentReel = reels[activeIndex]
  if (!currentReel || !currentReel.stream) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-white text-xl font-bold">라이브 준비 중...</div>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black no-scrollbar" style={{ scrollbarWidth: 'none' }}>
      <SEO title={`${reels[activeIndex]?.stream?.title || '라이브'} - 유어딜`} description="유어딜 라이브 방송을 시청하고 실시간으로 쇼핑하세요" url={`/live/${streamId}`} />
      <h1 className="sr-only">{reels[activeIndex]?.stream?.title || '라이브 방송'}</h1>
      <TopNav
        viewers={viewerCount}
        sellerName={reels[activeIndex]?.stream?.seller_name || reels[activeIndex]?.stream?.streamerName}
        sellerAvatar={reels[activeIndex]?.stream?.streamerAvatar}
        sellerId={reels[activeIndex]?.stream?.seller_id}
        sellerLinks={{
          youtube: reels[activeIndex]?.stream?.seller_youtube || undefined,
          instagram: reels[activeIndex]?.stream?.seller_instagram || undefined,
          kakao: reels[activeIndex]?.stream?.seller_kakao || undefined,
        }}
      />
      
      
      <div
        ref={containerRef}
        className={`h-dvh w-full no-scrollbar scrollbar-hide ${
          isDirectLink
            ? 'overflow-hidden' // Direct link: No scroll, single stream only
            : 'overflow-y-scroll snap-y snap-mandatory' // Homepage: Scrollable reels
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {reels.map((reel, index) => (
          <div
            key={`${reel.stream.id}-${reel.product?.id || 'no-product'}`}
            ref={reelRefs}
            data-index={index}
            className="h-dvh w-full snap-start snap-always"
          >
            <ReelCard 
              reel={reel} 
              isActive={activeIndex === index}
              isCurrentProduct={currentStream?.current_product_id === reel.product?.id}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
