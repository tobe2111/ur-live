/**
 * 🏠 2026-07-12 (앱-레디 트랙): 컨텍스트형 "홈 화면에 추가" 유도 — 지갑/구매완료 같은
 *   고관여 순간에만 인라인으로 노출한다.
 *
 * ⚠️ 전역 팝업(PWAInstallPrompt)은 대표 요청(2026-06-17)으로 App.tsx 에서 제거됨(방해 요소).
 *   이 컴포넌트는 그 팝업의 부활이 아니라 — 특정 화면 안에 얌전히 들어가는 인라인 카드다:
 *   standalone(이미 설치) · dismiss(30일) · 인앱 웹뷰(설치 unsupported) 면 렌더 안 함.
 *
 * TWA/Play 전환의 선행 투자: standalone 설치율이 곧 앱 품질 전제조건.
 */
import { useEffect, useState } from 'react'
import { Home, X } from 'lucide-react'
import { isPWAStandalone } from '@/lib/in-app-warning'
import { detectInAppBrowser, isIOS } from '@/lib/in-app-browser'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ur_a2hs_hint_dismissed_at'
const DISMISS_DAYS = 30

export default function AddToHomeHint({ context = 'wallet' }: { context?: 'wallet' | 'purchase' }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosManual, setIosManual] = useState(false)

  useEffect(() => {
    if (isPWAStandalone()) return                    // 이미 설치됨
    if (detectInAppBrowser()) return                 // 인앱 웹뷰 → 설치 unsupported (InAppBrowserBanner 담당)
    try {
      const at = localStorage.getItem(DISMISS_KEY)
      if (at && Date.now() - Number(at) < DISMISS_DAYS * 86400000) return
    } catch { /* ignore */ }

    // Android/Chrome: beforeinstallprompt 캡처 → 원탭 설치
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); setVisible(true) }
    window.addEventListener('beforeinstallprompt', onBIP)
    // iOS Safari: 표준 prompt 없음 → 수동 안내(공유 → 홈 화면에 추가)
    if (isIOS()) { setIosManual(true); setVisible(true) }
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const c = await deferred.userChoice
    if (c.outcome === 'accepted') setVisible(false)
    else dismiss()
  }

  if (!visible) return null

  const desc = context === 'purchase'
    ? '홈 화면 앱으로 추가하면 이용권을 매장에서 더 빨리 열 수 있어요 — 신호가 약해도 열려요.'
    : '홈 화면 앱으로 추가하면 이용권을 매장에서 더 빨리, 오프라인에서도 열 수 있어요.'

  return (
    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-gray-50 dark:bg-[#141414] px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 dark:bg-white">
        <Home className="h-4 w-4 text-white dark:text-gray-900" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white">홈 화면에 추가</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">{desc}</p>
        {iosManual ? (
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <b className="text-gray-700 dark:text-gray-200">공유 버튼 ⬆️ → “홈 화면에 추가”</b> 를 눌러주세요.
          </p>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-900 dark:bg-white px-3.5 py-1.5 text-[12px] font-bold text-white dark:text-gray-900 active:scale-95 transition-transform"
          >
            <Home className="h-3.5 w-3.5" /> 홈 화면에 추가하기
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="닫기" className="-m-1 shrink-0 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-[#1D1F29]">
        <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </button>
    </div>
  )
}
