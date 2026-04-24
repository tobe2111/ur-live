import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Youtube } from 'lucide-react'
import type { LiveStream } from '@/components/seller/broadcast/broadcast-types'

// ── YouTube Studio 대기 화면 (Quick / YouTube 공통) ─────────────
// Step 2 진입 시 자동으로 Studio 팝업 오픈 + 자동 감지 안내.
// onGoLive() 호출 안 함 — 폴링이 YouTube live 상태 감지 시에만 전환.
// stream.status === 'live' 가 되면 부모가 이 컴포넌트를 unmount → cleanup에서 팝업 자동 닫힘.
export function YouTubeStudioWaiting({ stream, accent }: { stream: LiveStream; accent: 'pink' | 'red' }) {
  const { t } = useTranslation()
  const popupRef = useRef<Window | null>(null)
  const openedRef = useRef(false)
  const vid = stream.youtube_video_id || stream.youtube_broadcast_id
  // ?ur_stream_id 로 우리 Chrome Extension 에 streamId 전달
  //   → Extension content-studio.js 가 사이드바 iframe 을 /embed/live/:id 로 자동 연결
  const studioUrl = vid
    ? `https://studio.youtube.com/video/${vid}/livestreaming?ur_stream_id=${stream.id}`
    : `https://studio.youtube.com/channel/UC/livestreaming?ur_stream_id=${stream.id}`

  function openPopup() {
    const w = Math.min(1280, Math.floor(window.screen.availWidth * 0.85))
    const h = Math.min(820, Math.floor(window.screen.availHeight * 0.85))
    const left = Math.floor((window.screen.availWidth - w) / 2)
    const top = Math.floor((window.screen.availHeight - h) / 2)
    const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener`
    try {
      const p = window.open(studioUrl, 'ur-yt-studio', features)
      if (p) popupRef.current = p
    } catch { /* blocked */ }
  }

  // YouTube 공식 앱 Deep link (모바일) — 구독자 50+ 필요 (YouTube 정책)
  // 설치된 YouTube 앱을 직접 엶 → 새로운 앱 설치 부담 0
  function openYouTubeApp() {
    // Universal link / App Store scheme
    // iOS: youtube:// / Android: vnd.youtube:// OR 그냥 https 링크 (자동 앱 열기)
    const videoUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : 'https://m.youtube.com/'
    try {
      window.location.href = videoUrl
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    const tid = setTimeout(openPopup, 200)
    return () => {
      clearTimeout(tid)
      // 컴포넌트 unmount 시 (= live 전환 시) 팝업 자동 닫기
      try {
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
      } catch { /* ignore */ }
      popupRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const colorMap = {
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'bg-pink-100 text-pink-600', dot: 'bg-pink-400', accent: 'text-pink-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', dot: 'bg-red-400', accent: 'text-red-700' },
  }[accent]

  return (
    <div className={`${colorMap.bg} border ${colorMap.border} rounded-xl p-5 space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${colorMap.icon} rounded-xl flex items-center justify-center`}>
          <Youtube className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{t('seller.liveBroadcast.studioOpened')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('seller.liveBroadcast.studioOpenedDesc')}</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2.5 border ${colorMap.border}`}>
        <span className="flex gap-1 shrink-0">
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${colorMap.dot} animate-bounce`}
              style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
        <p className={`text-xs font-medium ${colorMap.accent} flex-1`}>
          {t('seller.liveBroadcast.autoDetecting')}
        </p>
      </div>

      <button onClick={openPopup}
        className="w-full text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 py-1">
        {t('seller.liveBroadcast.reopenStudio')}
      </button>

      {/* 모바일 기기 접속 시 YouTube 앱 딥링크 대안 제시 */}
      {typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent) && (
        <button onClick={openYouTubeApp}
          className="w-full mt-1 py-2 bg-white/70 hover:bg-white border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
          📱 YouTube 앱에서 열기
        </button>
      )}
    </div>
  )
}
