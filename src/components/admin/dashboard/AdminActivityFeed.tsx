import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'

export function AdminActivityFeed() {
  const [orders, setOrders] = useState<any[]>([])
  const lastCountRef = useRef(0)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const fetchOrders = () => {
    api.get('/api/admin/orders?page=1&limit=8', h)
      .then(r => {
        const list = r.data.data?.orders || r.data.data || []
        if (list.length > lastCountRef.current && lastCountRef.current > 0) {
          // 새 주문 알림
          try { new Audio('/static/notification.mp3').play().catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }) } catch {}
        }
        lastCountRef.current = list.length
        if (r.data.success) setOrders(list)
      }).catch(() => { /* empty activity list is shown on error */ })
  }
  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000) // 30초 자동 갱신
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">최근 활동</h3>
      {orders.length === 0 ? <p className="text-xs text-gray-400">활동이 없습니다</p> : (
        <div className="space-y-2">
          {orders.slice(0, 8).map((o: { status: string; order_number: string; total_amount: number; created_at?: string }, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-gray-700 flex-1 truncate">
                {o.status === 'PAID' || o.status === 'DONE' ? '💰 주문' : o.status === 'SHIPPING' ? '📦 배송' : o.status === 'CANCELLED' ? '❌ 취소' : '📝 ' + o.status}
                {' '}{o.order_number} · {Number(o.total_amount || 0).toLocaleString()}원
              </span>
              <span className="text-gray-400 shrink-0">{o.created_at ? new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
