import { useEffect } from 'react'

/**
 * PushNotificationSetup
 *
 * Mounts invisibly in AppContent. After a 10-second delay it:
 * 1. Checks browser support for Service Worker + PushManager
 * 2. Skips if user is not logged in or already subscribed
 * 3. Requests notification permission
 * 4. Subscribes to push via the existing service worker
 * 5. POSTs the subscription to /api/push/subscribe (Bearer + cookie 동시)
 *
 * 🛡️ 2026-04-28: body 형식 fix — 서버 (push.routes.ts) 는 raw subscription 기대.
 *   이전: { subscription, user_id } → server 가 endpoint 추출 실패 → save fail.
 *   현재: subscription.toJSON() 그대로 POST.
 *   role 토큰 자동 주입 (admin/seller/agency/user) + session cookie credentials.
 */
export default function PushNotificationSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // 모든 role 지원: user/seller/admin/agency
    const isLoggedIn =
      localStorage.getItem('user_id') ||
      localStorage.getItem('seller_id') ||
      localStorage.getItem('admin_id') ||
      localStorage.getItem('agency_id')
    if (!isLoggedIn) return

    // Don't re-ask if already subscribed
    if (localStorage.getItem('push_subscribed')) return

    // Wait 10 seconds before asking (don't interrupt UX)
    const timer = setTimeout(async () => {
      try {
        // 🛡️ 2026-04-28: push-sw.js (push-only, no fetch handler) 명시적 등록.
        //   main.tsx 의 unregister 로직이 push-sw.js 만 보호함.
        //   VAPID 키 없으면 SW 등록 자체를 건너뜀 (불필요한 등록 방지).
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          if (import.meta.env.DEV) {
            console.info('[PushNotification] VITE_VAPID_PUBLIC_KEY missing — push disabled.')
          }
          return
        }

        let reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
        if (!reg) {
          reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
        }
        // 활성 상태까지 대기 (max 5s)
        if (!reg.active) {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 5000)
            const sw = reg!.installing || reg!.waiting
            if (!sw) { clearTimeout(t); resolve(); return }
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') { clearTimeout(t); resolve() }
            })
          })
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })

        // Bearer token 우선 (admin > agency > seller > user firebase token), 없으면 cookie
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
      } catch {
        // Silently fail — push is non-critical
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  return null
}
