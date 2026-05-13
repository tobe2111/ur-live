import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import ReelCard from '@/components/live/ReelCard'
import ReelErrorBoundary from '@/components/live/ReelErrorBoundary'
import '@/utils/console-suppressor'
import TopNav from './live-page/TopNav'
import type { Stream, ReelData } from './live-page/types'
import { useStreamStore } from '@/shared/stores/useStreamStore'

// 🛡️ 2026-05-01: TD-018 분할 — types / icons / TopNav 를 ./live-page/ 로 이동.
// HeartReaction, LiveChat, ProductListSheet, ReelCard → @/components/live/ 에 위치.

// ============================================
// Main LivePageV2 Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
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
  // 🛡️ 2026-05-07: reelRefs 는 useEffect 보다 먼저 실행되므로 노드를 별도 저장.
  //   observer 생성 후 pendingNodes 를 일괄 observe 해 race condition 방어.
  const pendingNodesRef = useRef<HTMLDivElement[]>([])

  const [currentStream, setCurrentStream] = useState<Stream | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // 페이지네이션 상태 (lazy loading)
  const STREAM_PAGE_SIZE = 5
  const streamOffsetRef = useRef(0)
  const hasMoreStreamsRef = useRef(true)
  const loadingMoreRef = useRef(false)

  // 시청자 수: DO WebSocket (ReelCard 내부) → store 로 전달, 여기선 store 읽기만
  const viewerCount = useStreamStore(s => s.viewerCount)

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
    if (observerRef.current) {
      observerRef.current.observe(node)
    } else {
      pendingNodesRef.current.push(node)
    }
  }, [])

  useEffect(() => {
    // 🛡️ 2026-05-03 TD-024 fix: 스크롤 시 가장 많이 보이는 reel 을 active 로 결정.
    // 기존: entries.forEach + isIntersecting → 여러 entry 가 동시 visible 일 때 마지막 entry 가 win.
    //       스크롤 transition 중 잘못된 reel 이 active 로 잡혀 영상 재생 안 되는 사고 원인.
    // 개선: 모든 visible entry 중 intersectionRatio 가장 높은 것만 active.
    //       multiple thresholds 로 더 정확한 ratio 측정.
    observerRef.current = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
            bestEntry = entry
          }
        })
        if (bestEntry) {
          const index = Number((bestEntry as IntersectionObserverEntry).target.getAttribute('data-index'))
          if (Number.isFinite(index)) setActiveIndex(index)
        }
      },
      {
        root: containerRef.current,
        threshold: [0.3, 0.5, 0.7, 0.9],
      }
    )
    // reelRefs 가 observer 생성 전에 실행됐을 경우 pending 노드들 일괄 등록
    pendingNodesRef.current.forEach(node => observerRef.current!.observe(node))
    pendingNodesRef.current = []

    return () => observerRef.current?.disconnect()
  }, [])

  // Load reels data - MODIFIED: Check if direct link or from homepage
  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    const loadReels = async () => {
      try {

        const hasStreamId = !!streamId

        // 🛡️ 2026-05-13: 메인페이지에서 예정/종료 방송 클릭 시 "진행 중인 라이브가 없어요" 출력 사고 수정.
        //   기존: isFromHomepage=true 면 status='live' 만 fetch → 예정/종료는 미포함 → 빈 화면.
        //   해결: streamId 있으면 ALWAYS 그 stream 먼저 fetch. status='live' 면 추가로 다른 live 도 로드 (reels scroll).
        //   예정/종료면 단일 스트림 모드 (ScheduledOverlay / VOD UI 가 알아서 표시).
        let streams: Stream[] = []
        let singleStreamData: Stream | null = null

        if (hasStreamId && streamId) {
          try {
            const singleStreamResponse = await api.get(`/api/streams/${streamId}`)
            if (singleStreamResponse.data.success && singleStreamResponse.data.data) {
              singleStreamData = singleStreamResponse.data.data as Stream
              streams = [singleStreamData]
            }
          } catch (error) {
            if (import.meta.env.DEV) console.error('[LivePageV2] Single stream API failed:', error)
          }
        }

        // 단일 스트림 모드 판정: streamId 있고 그 stream 이 live 가 아니면 reels scroll 불필요.
        // live 면 추가로 다른 live streams 도 로드해 scroll 가능하게.
        const isLiveStream = singleStreamData?.status === 'live'
        const shouldShowSingleStream = hasStreamId && !isLiveStream
        setIsDirectLink(shouldShowSingleStream)

        if (!shouldShowSingleStream) {
          // 라이브 (또는 streamId 없는 진입) → 추가 라이브 목록 fetch 해서 reels scroll 활성
          try {
            const streamsResponse = await api.get(`/api/streams?status=live&limit=${STREAM_PAGE_SIZE}&offset=0`)
            if (streamsResponse.data.success && streamsResponse.data.data?.length > 0) {
              const liveStreams = streamsResponse.data.data as Stream[]
              // 단일 stream 이 이미 로드돼 있으면 중복 제거
              const existingIds = new Set(streams.map(s => s.id))
              const merged = [
                ...streams,
                ...liveStreams.filter((s) => !existingIds.has(s.id)),
              ]
              streams = merged
              streamOffsetRef.current = liveStreams.length
              hasMoreStreamsRef.current = streamsResponse.data.pagination?.has_more ?? false
            }
          } catch (error) {
            if (import.meta.env.DEV) console.error('[LivePageV2] Streams list API failed:', error)
            // streams (단일) 가 있으면 그걸로 진행, 없으면 throw
            if (streams.length === 0) throw error
          }
        }
            
        // Set current stream from URL parameter
        if (streamId) {
          const currentStreamData = streams.find(s => s.id === parseInt(streamId))
          if (currentStreamData) {
            setCurrentStream(currentStreamData)
            document.title = t('live.page.docTitle', { defaultValue: '{{title}} - 유어딜 라이브', title: currentStreamData.title })
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
        setLoadError(true)
        setLoading(false)
      }
    }

    loadReels()
  }, [streamId, retryCount])

  // 스트림 추가 로드 (lazy loading)
  const loadMoreReels = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreStreamsRef.current || isDirectLink) return
    loadingMoreRef.current = true
    try {
      const res = await api.get(`/api/streams?status=live&limit=${STREAM_PAGE_SIZE}&offset=${streamOffsetRef.current}`)
      if (res.data.success && res.data.data?.length > 0) {
        const newStreams: Stream[] = res.data.data
        streamOffsetRef.current += newStreams.length
        hasMoreStreamsRef.current = res.data.pagination?.has_more ?? false
        setReels(prev => [
          ...prev,
          ...newStreams.map(s => ({ stream: s, product: s.current_product || null })),
        ])
      } else {
        hasMoreStreamsRef.current = false
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LivePageV2] loadMoreReels failed:', e)
    } finally {
      loadingMoreRef.current = false
    }
  }, [isDirectLink])

  // 마지막 2개 카드 이내로 접근하면 다음 페이지 프리페치
  useEffect(() => {
    if (reels.length === 0 || isDirectLink) return
    if (activeIndex >= reels.length - 2 && hasMoreStreamsRef.current) {
      loadMoreReels()
    }
  }, [activeIndex, reels.length, isDirectLink, loadMoreReels])

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

  // 🔥 KV 기반 시청자 세션 추적 (Heartbeat) — 시청자 수는 DO WebSocket 이 담당
  useEffect(() => {
    if (!currentStream?.id) return

    let sessionId = sessionStorage.getItem('viewer_session_id')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('viewer_session_id', sessionId)
    }

    const joinViewer = async () => {
      try {
        await api.post(`/api/streams/${currentStream.id}/viewer/join`, {}, {
          headers: { 'X-Session-ID': sessionId }
        })
      } catch (error) {
        if (import.meta.env.DEV) console.error('[LivePageV2] Failed to join viewer:', error)
      }
    }

    joinViewer()

    // 30초마다 Heartbeat (TTL 120s) — 백그라운드 탭 skip
    const heartbeatInterval = setInterval(() => { if (!document.hidden) joinViewer() }, 30000)

    const leaveBeacon = () => {
      try {
        const url = `/api/streams/${currentStream.id}/viewer/leave`
        const blob = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' })
        navigator.sendBeacon?.(`${url}?s=${encodeURIComponent(sessionId)}`, blob)
      } catch { /* best-effort */ }
    }
    window.addEventListener('pagehide', leaveBeacon)
    window.addEventListener('beforeunload', leaveBeacon)

    return () => {
      clearInterval(heartbeatInterval)
      window.removeEventListener('pagehide', leaveBeacon)
      window.removeEventListener('beforeunload', leaveBeacon)
      leaveBeacon()
    }
  }, [currentStream?.id])

  // ✅ 로딩 중 표시
  if (loading) {
    return (
      <div className="absolute inset-0 bg-white dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-gray-900 dark:text-white text-xl font-bold">{t('live.page.entering', { defaultValue: '라이브 입장 중...' })}</div>
          <div className="text-gray-500 dark:text-white/60 text-sm">{t('live.page.pleaseWait', { defaultValue: '잠시만 기다려주세요' })}</div>
        </div>
      </div>
    )
  }

  // ✅ API 오류 표시
  if (loadError) {
    return (
      <div className="absolute inset-0 bg-[#020202] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="text-white font-bold text-[17px] mb-1">{t('live.page.loadError', { defaultValue: '방송을 불러올 수 없어요' })}</p>
        <p className="text-white/50 text-[13px] mb-6">{t('live.page.loadErrorSub', { defaultValue: '잠시 후 다시 시도해주세요' })}</p>
        <div className="flex gap-2">
          <button onClick={() => { setLoadError(false); setRetryCount(c => c + 1) }} className="px-5 py-2.5 bg-[#EF4444] text-white text-[13px] font-semibold rounded-full">
            {t('common.retry', { defaultValue: '다시 시도' })}
          </button>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-white/[0.08] text-white text-[13px] font-semibold rounded-full">
            {t('live.scheduled.goHome', { defaultValue: '홈으로' })}
          </button>
        </div>
      </div>
    )
  }

  // ✅ 데이터 없음 표시
  if (reels.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#020202] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
        <p className="text-white font-bold text-[17px] mb-1">{t('live.page.noLive', { defaultValue: '진행 중인 라이브가 없어요' })}</p>
        <p className="text-white/50 text-[13px] mb-6">{t('live.page.noLiveSubtitle', { defaultValue: '라이브 방송이 시작되면 알림을 보내드릴게요' })}</p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/live')} className="px-5 py-2.5 bg-white/[0.08] text-white text-[13px] font-semibold rounded-full hover:bg-white/[0.14] transition-colors">
            {t('live.page.broadcastList', { defaultValue: '방송 목록 보기' })}
          </button>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-[#EF4444] text-white text-[13px] font-semibold rounded-full hover:bg-[#DC2626] transition-colors">
            {t('live.scheduled.goHome', { defaultValue: '홈으로' })}
          </button>
        </div>
      </div>
    )
  }

  // ✅ activeIndex가 유효한 범위인지 확인
  const currentReel = reels[activeIndex]
  if (!currentReel || !currentReel.stream) {
    return (
      <div className="absolute inset-0 bg-white dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-gray-900 dark:text-white text-xl font-bold">{t('live.page.preparing', { defaultValue: '라이브 준비 중...' })}</div>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black no-scrollbar" style={{ scrollbarWidth: 'none' }}>
      <SEO title={t('live.page.seoTitle', { defaultValue: '{{title}} - 유어딜', title: reels[activeIndex]?.stream?.title || t('live.page.seoFallbackTitle', { defaultValue: '라이브' }) })} description={t('live.page.seoDescription', { defaultValue: '유어딜 라이브 방송을 시청하고 실시간으로 쇼핑하세요' })} url={`/live/${streamId}`} />
      <h1 className="sr-only">{reels[activeIndex]?.stream?.title || t('live.page.srHeading', { defaultValue: '라이브 방송' })}</h1>
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
            <ReelErrorBoundary>
              <ReelCard
                reel={reel}
                isActive={activeIndex === index}
                isCurrentProduct={currentStream?.current_product_id === reel.product?.id}
              />
            </ReelErrorBoundary>
          </div>
        ))}
      </div>
    </main>
  )
}
