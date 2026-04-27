import { useEffect } from 'react'

/**
 * PushNotificationSetup
 *
 * Mounts invisibly in AppContent. After a 10-second delay it:
 * 1. Checks browser support for Service Worker + PushManager
 * 2. Skips if user is not logged in or already subscribed
 * 3. Requests notification permission
 * 4. Subscribes to push via the existing service worker
 * 5. POSTs the subscription to /api/push/subscribe
 */
export default function PushNotificationSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const userId = localStorage.getItem('user_id')
    if (!userId) return

    // Don't re-ask if already subscribed
    if (localStorage.getItem('push_subscribed')) return

    // Wait 10 seconds before asking (don't interrupt UX)
    const timer = setTimeout(async () => {
      try {
        // 🛡️ 2026-04-27: Service Worker 가 main.tsx 에서 unregister 되므로
        // navigator.serviceWorker.ready 는 영원히 pending. 등록된 SW 가 없으면 즉시 종료.
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) {
          if (import.meta.env.DEV) {
            console.info('[PushNotification] Service Worker not registered — push disabled.')
          }
          return
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), user_id: userId })
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
