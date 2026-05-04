import React, { useRef, useEffect } from 'react'

interface YTPlayer {
  destroy(): void
}

interface LiveStreamPlayerProps {
  youtubeVideoId?: string
  isFullscreen?: boolean
  onPlayerReady?: (event: any) => void
  className?: string
}

export const LiveStreamPlayer = React.memo(function LiveStreamPlayer({
  youtubeVideoId,
  isFullscreen = false,
  onPlayerReady,
  className = ''
}: LiveStreamPlayerProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)

  useEffect(() => {
    if (!youtubeVideoId) return

    // YouTube IFrame Player API 로드
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    // YouTube API 준비 완료 후 플레이어 생성
    const initPlayer = () => {
      if (playerContainerRef.current && (window as any).YT) {
        playerRef.current = new (window as any).YT.Player(playerContainerRef.current, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
          },
          events: {
            onReady: onPlayerReady,
          },
        })
      }
    }

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer()
    } else {
      // 다른 컴포넌트의 콜백을 덮어쓰지 않도록 전역 배열에 push
      if (!(window as any).youtubeCallbacks) (window as any).youtubeCallbacks = []
      ;(window as any).youtubeCallbacks.push(initPlayer)
    }

    return () => {
      try { playerRef.current?.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }
  }, [youtubeVideoId, onPlayerReady])

  if (!youtubeVideoId) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${className}`}>
        <div className="text-center text-gray-900 dark:text-white">
          <div className="mb-4 text-6xl">📹</div>
          <p className="text-lg">스트림을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <div
        ref={playerContainerRef}
        className="w-full h-full"
        style={{ aspectRatio: '16/9' }}
      />
      
      {isFullscreen && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold">
            LIVE
          </div>
        </div>
      )}
    </div>
  )
})
