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

    // 🛡️ 2026-04-30: 인앱 webview 면 PWA 설치 prompt 안 띄움.
    //   카카오/네이버앱/FB/IG/Line 인앱은 SW 등록 자체를 차단 → beforeinstallprompt 발생 X.
    //   대신 InAppBrowserBanner 가 외부 브라우저 유도 (분리된 책임).
    if (inApp) return

    // Android / Samsung Internet / Edge — 표준 prompt 캡처
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // 5초 지연 (UX 방해 최소화 — 사용자가 콘텐츠 먼저 확인)
      setTimeout(() => setShow(true), 5000)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // 사용자가 설치 완료 시 prompt 정리
    const onInstalled = () => {
      setShow(false)
      setIosManual(false)
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* */ }
    }
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari — 표준 prompt 미지원 → 수동 안내.
    //   Chrome iOS / FireFox iOS 도 동일 (모두 WebKit, 표준 PWA install 지원 X).
    //   조건: standalone 모드 아닐 때만 (이미 설치되어 standalone 으로 진입했을 가능성 차단)
    if (isIOS() && !window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => setIosManual(true), 8000)
    }

    // 🛡️ Android Chrome 에서 beforeinstallprompt 가 안 떠도 (SW 활성 안 됨, 사용자 engagement 부족 등)
    //   사용자에게 알려주는 fallback — 30초 후에도 prompt 캡처 안 됐으면 수동 안내.
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    if (isAndroid()) {
      fallbackTimer = setTimeout(() => {
        if (!deferredPrompt) {
          // beforeinstallprompt 안 떴음 — Chrome 메뉴에서 수동 설치 안내
          setIosManual(true) // 수동 안내 모달 재사용 (텍스트는 분기)
        }
      }, 30000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
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

  // iOS Safari / Android Chrome fallback — 수동 안내 (OS 별 분기)
  if (iosManual) {
    const isIOSDevice = isIOS()
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[60] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-pink-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">유어딜을 앱처럼 사용하기</p>
              {isIOSDevice ? (
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  하단 공유 <span className="inline-block">⬆️</span> 메뉴 → <strong>"홈 화면에 추가"</strong> 선택
                </p>
              ) : (
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  Chrome 우상단 메뉴 ⋮ → <strong>"앱 설치"</strong> 또는 <strong>"홈 화면에 추가"</strong>
                </p>
              )}
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
