/**
 * 웹 푸시 알림 구독 배너
 * - 메인 페이지 하단에 표시
 * - 알림 권한 요청 → Service Worker 등록 → 서버에 구독 전송
 */
import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import api from '@/lib/api'

export default function PushNotificationBanner() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 이미 구독했거나, 거절했거나, 지원하지 않으면 숨김
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (localStorage.getItem('push_dismissed') === '1') return
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return
    setShow(true)
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setShow(false)
        localStorage.setItem('push_dismissed', '1')
        return
      }

      const reg = await navigator.serviceWorker.register('/static/sw.js')
      await navigator.serviceWorker.ready

      // VAPID 공개 키 가져오기
      let vapidKey = ''
      try {
        const res = await api.get('/api/push/vapid-public-key')
        vapidKey = res.data.publicKey || ''
      } catch {}

      if (vapidKey) {
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })

        await api.post('/api/push/subscribe', subscription.toJSON())
      }

      setShow(false)
      localStorage.setItem('push_subscribed', '1')
    } catch {
      // 에러 시 조용히 닫기
      setShow(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('push_dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto">
      <div className="bg-gray-900 rounded-2xl p-4 shadow-2xl border border-gray-700 flex items-start gap-3">
        <div className="w-10 h-10 bg-pink-500/20 rounded-full flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">알림 받기</p>
          <p className="text-xs text-gray-400 mt-0.5">라이브 방송, 특가 딜, 주문 상태를 실시간으로 알려드려요</p>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="mt-2 px-4 py-1.5 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '설정 중...' : '알림 허용'}
          </button>
        </div>
        <button onClick={handleDismiss} className="p-1 text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
