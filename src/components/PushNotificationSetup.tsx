import { useEffect, useState, useCallback } from 'react'
import { isPWAStandalone, isFeatureBlockedSync } from '@/lib/in-app-warning'
import { useTranslation } from 'react-i18next'
import { Bell, X } from 'lucide-react'

/**
 * PushNotificationSetup
 *
 * 🏁 2026-06-12 (전 플로우 감사 🟢 — soft-prompt 전환, 사용자 승인 "모두 이상적"):
 *   기존: 로그인 10초 후 **제스처 없이** Notification.requestPermission() 자동 호출 —
 *   Safari 는 무시, Chrome 은 quiet-UI 강등 + 맥락 없는 권한 팝업(수락률 최악 패턴).
 *   변경: 가치 설명 인앱 배너(soft prompt) → "켜기" 탭(제스처) 시에만 브라우저 권한 요청.
 *   '나중에' = 14일 스누즈. 구독/전송 로직(push-sw.js, /api/push/subscribe)은 동일.
 *
 * 🛡️ 2026-04-28: body 형식 — 서버 (push.routes.ts) 는 raw subscription 기대.
 *   role 토큰 자동 주입 (admin/seller/agency/user) + session cookie credentials.
 */
const SNOOZE_KEY = 'push_prompt_snooze_until'
const SNOOZE_DAYS = 14

export default function PushNotificationSetup() {
  const { t } = useTranslation()
  const [showBanner, setShowBanner] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined') return

    // 모든 role 지원: user/seller/admin/agency
    const isLoggedIn =
      localStorage.getItem('user_id') ||
      localStorage.getItem('seller_id') ||
      localStorage.getItem('admin_id') ||
      localStorage.getItem('agency_id')
    if (!isLoggedIn) return

    if (Notification.permission === 'denied') return

    // 🛡️ 2026-04-30 v2: PWA standalone 이면 풀 기능 → 진행. 아니면 인앱 매트릭스 체크.
    if (!isPWAStandalone() && isFeatureBlockedSync('notification')) {
      if (import.meta.env.DEV) console.info('[PushNotification] In-app webview blocked — skipping')
      return
    }
    // VAPID 키 없으면 푸시 자체가 불가 — 배너도 안 띄움
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return

    // 🔔 2026-07-01: 권한이 이미 granted 면 배너 없이 **항상** 서버 구독을 재조정(self-heal).
    //   이전엔 localStorage.push_subscribed 플래그가 있으면 조기 return 해서, 브라우저가
    //   endpoint 를 교체하거나 서버가 410 으로 구독행을 지우면 클라는 '구독됨'으로 착각하고
    //   영구 두절됐음. 이제 getSubscription→재전송(ON CONFLICT 멱등)으로 매 마운트 self-heal.
    //   push_subscribed 는 배너 억제용으로만 사용.
    if (Notification.permission === 'granted') {
      const timer = setTimeout(() => { void subscribe(false) }, 8000)
      return () => clearTimeout(timer)
    }

    // permission === 'default' (아직 안 물어봄) — 구독 이력/스누즈면 배너 skip
    if (localStorage.getItem('push_subscribed')) return
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || 0)
      if (until && Date.now() < until) return
    } catch { /* */ }

    const timer = setTimeout(() => setShowBanner(true), 10000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subscribe = useCallback(async (fromGesture: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      // 🛡️ 2026-04-28: push-sw.js (push-only, no fetch handler) 명시적 등록.
      let reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
      if (!reg) {
        reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
      }
      if (!reg.active) {
        await new Promise<void>((resolve) => {
          const tmo = setTimeout(resolve, 5000)
          const sw = reg!.installing || reg!.waiting
          if (!sw) { clearTimeout(tmo); resolve(); return }
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') { clearTimeout(tmo); resolve() }
          })
        })
      }

      // 🔔 2026-07-01: 기존 브라우저 구독을 우선 재사용(self-heal). 없을 때만 새로 구독.
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        // 제스처 문맥에서만 권한 요청 (granted 재구독 경로는 요청 불필요)
        if (Notification.permission !== 'granted') {
          if (!fromGesture) return
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') { setShowBanner(false); return }
        }
        try {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        } catch (subErr) {
          // 다른 VAPID 키로 만든 구독이 남아 있으면 InvalidStateError — 교체 후 재시도(키 로테이션 self-heal).
          const stale = await reg.pushManager.getSubscription()
          if (stale) { try { await stale.unsubscribe() } catch { /* */ } sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey }) }
          else throw subErr
        }
      }

      const token =
        localStorage.getItem('admin_token') ||
        localStorage.getItem('agency_token') ||
        localStorage.getItem('seller_token') ||
        localStorage.getItem('user_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(sub.toJSON()),
      })

      localStorage.setItem('push_subscribed', 'true')
      setShowBanner(false)
    } catch {
      // Silently fail — push is non-critical
    } finally {
      setBusy(false)
    }
  }, [busy])

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000)) } catch { /* */ }
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[400px] z-[9000] animate-sheet-up">
      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-pink-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">
            {t('push.promptTitle', { defaultValue: '알림을 켜시겠어요?' })}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {t('push.promptDesc', { defaultValue: '교환권 만료 임박, 공구 마감, 적립 소식을 놓치지 않게 알려드려요' })}
          </p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => void subscribe(true)} disabled={busy}
              className="px-3.5 py-1.5 bg-pink-500 text-white rounded-lg text-[12px] font-bold disabled:opacity-50">
              {t('push.promptOn', { defaultValue: '켜기' })}
            </button>
            <button onClick={snooze}
              className="px-3.5 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 rounded-lg text-[12px] font-semibold">
              {t('push.promptLater', { defaultValue: '나중에' })}
            </button>
          </div>
        </div>
        <button onClick={snooze} aria-label="close" className="p-1 -m-1 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
