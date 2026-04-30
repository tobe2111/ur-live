/**
 * 🛡️ 2026-04-30: PWA 설치 prompt — 인앱 webview 사용자에게 "홈 화면 설치" 강력 권장.
 *
 * 효과: 홈 화면 설치 후 → standalone 모드 → 카카오/FB/IG 인앱 차단 모두 우회.
 *   카메라/푸시/popup/WebSocket 모두 풀 기능.
 *
 * 동작:
 *   - beforeinstallprompt 이벤트 캡처 (Android Chrome / Samsung Internet)
 *   - iOS Safari 는 표준 prompt 미지원 → 수동 안내 ('공유 → 홈 화면에 추가')
 *   - 한 번 dismiss 하면 7일간 안 나옴 (localStorage)
 *   - 이미 standalone 모드면 안 나옴
 */
import { useEffect, useState } from 'react'
import { Smartphone, X, Plus } from 'lucide-react'
import { isPWAStandalone } from '@/lib/in-app-warning'
import { detectInAppBrowser, isIOS, isAndroid } from '@/lib/in-app-browser'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ur_pwa_install_dismissed_at'
const DISMISS_DAYS = 7

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosManual, setIosManual] = useState(false)

  useEffect(() => {
    if (isPWAStandalone()) return // 이미 설치됨

    // dismiss 7일 가드
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageMs = Date.now() - Number(dismissedAt)
        if (ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000) return
      }
    } catch { /* ignore */ }

    const inApp = detectInAppBrowser()

    // Android / Samsung Internet — 표준 prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // 인앱 사용자 우선 (카메라/popup 차단 환경) — 즉시 표시
      // 일반 브라우저 사용자는 5초 지연 (UX 방해 ↓)
      const delay = inApp ? 1500 : 5000
      setTimeout(() => setShow(true), delay)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari — 표준 prompt 없음. 수동 안내.
    //   인앱 webview 면 "공유 메뉴" 도 안 보일 수 있어 외부 브라우저 권장이 더 효과적.
    if (isIOS() && !inApp && !window.matchMedia('(display-mode: standalone)').matches) {
      // 일반 Safari 만 수동 안내 표시 (인앱은 InAppBrowserBanner 가 처리)
      setTimeout(() => setIosManual(true), 8000)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShow(false)
    } else {
      handleDismiss()
    }
  }

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* */ }
    setShow(false)
    setIosManual(false)
  }

  // Android / Samsung Internet — 표준 install prompt
  if (show && deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[60] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-pink-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">유어딜을 앱처럼 사용하기</p>
              <p className="text-[12px] text-gray-500 mt-0.5">홈 화면에 추가하면 더 빠르고 알림도 받을 수 있어요</p>
            </div>
            <button onClick={handleDismiss} aria-label="닫기" className="p-1 -m-1 rounded-full hover:bg-gray-100 shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-pink-500 text-white rounded-xl font-bold text-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              설치하기
            </button>
            <button onClick={handleDismiss} className="px-4 py-2.5 text-gray-500 text-sm font-medium">
              나중에
            </button>
          </div>
        </div>
      </div>
    )
  }

  // iOS Safari — 수동 안내
  if (iosManual) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[60] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-pink-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">유어딜을 앱처럼 사용하기</p>
              <p className="text-[12px] text-gray-500 mt-0.5">하단 공유 <span className="inline-block">⬆️</span> 메뉴 → "홈 화면에 추가"</p>
            </div>
            <button onClick={handleDismiss} aria-label="닫기" className="p-1 -m-1 rounded-full hover:bg-gray-100 shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
