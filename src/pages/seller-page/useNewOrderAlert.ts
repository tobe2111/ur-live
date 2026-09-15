/**
 * 🔔 새 주문 알림 — 브라우저 Notification + 짧은 사운드 (2026-04-23 배치 170 → 2026-09-14 훅으로 추출).
 *   홈이 10초마다 받는 주문 목록의 **최대 id 가 커지면** 새 주문이다. 첫 로드는 알리지 않는다(기준값만 잡는다).
 *   🛡️ 2026-05-27 (memory): Audio 는 module-scope 1회 생성. 🛡️ 2026-06-04 (CSP): data:audio 차단 → Blob URL.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { swallow } from '@/shared/utils/swallow'
import type { Order } from './types'

const NEW_ORDER_WAV_B64 = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeWj4J1aGBneIONkpGLgXRtZ2l4hI+UkYyBdWxnbHqFkJSTjoF1bGdteYWQlJOOgXVsZ2x5hpGVk46BdWxnbHmFkJSTjoF1bGdteYWQlJOOgXVsZ2x5hpGVk46BdWxnbHmFkJSTjoF1'
const newOrderAudio: HTMLAudioElement = (() => {
  if (typeof Audio === 'undefined') return { play: () => Promise.resolve(), currentTime: 0 } as unknown as HTMLAudioElement
  try {
    const bytes = Uint8Array.from(atob(NEW_ORDER_WAV_B64), (ch) => ch.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    return Object.assign(new Audio(url), { volume: 0.3 })
  } catch {
    return { play: () => Promise.resolve(), currentTime: 0 } as unknown as HTMLAudioElement
  }
})()

export function useNewOrderAlert(orders: Order[]) {
  const { t } = useTranslation()
  const lastMaxIdRef = useRef<number>(0)
  useEffect(() => {
    if (orders.length === 0) return
    const maxId = Math.max(...orders.map((o) => Number(o.id) || 0))
    if (lastMaxIdRef.current > 0 && maxId > lastMaxIdRef.current) {
      const count = orders.filter((o) => Number(o.id) > lastMaxIdRef.current).length
      try {
        if (typeof Notification !== 'undefined') {
          if (Notification.permission === 'granted') {
            new Notification(t('seller.newOrderNotifTitle', { defaultValue: '🛒 새 주문이 들어왔어요!' }), {
              body: t('seller.newOrderNotifBody', { defaultValue: '{{count}}건의 새 주문을 확인하세요', count }),
              icon: '/icon-biz-192.png',
            })
          } else if (Notification.permission === 'default') {
            Notification.requestPermission()
          }
        }
        newOrderAudio.currentTime = 0
        newOrderAudio.play().catch(swallow('seller:new-order-audio'))
      } catch { /* non-critical */ }
    }
    lastMaxIdRef.current = maxId
  }, [orders, t])
}
