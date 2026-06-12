/**
 * 🔔 2026-06-12 (도매몰 감사 fix): 제조사 알림 벨.
 *   출금 승인/반려·신규 도매주문 등 recipient_type='supplier' 알림을 읽을 UI 가 없어
 *   데드 코드였던 것을 배선. mount 시 1회 + 60s 간격(탭 숨김이면 skip) unread 갱신,
 *   열면 목록 로드 + 전체 읽음(POST /notifications/read-all).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'

interface SupplierNotificationRow {
  id: number
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: number
  created_at: string
}

export default function NotificationsBell({ t, onNavigate }: {
  t: (k: string, o?: Record<string, unknown>) => string
  onNavigate: (link: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SupplierNotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const refreshUnread = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const res = await supplierApi.get<{ items: SupplierNotificationRow[]; unread: number }>('/api/supplier/notifications?limit=1')
      setUnread(Number(res.unread) || 0)
    } catch { /* 배지 갱신 실패는 조용히 — 다음 주기 재시도 */ }
  }, [])

  useEffect(() => {
    refreshUnread()
    const iv = setInterval(refreshUnread, 60_000)
    return () => clearInterval(iv)
  }, [refreshUnread])

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openPanel = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await supplierApi.get<{ items: SupplierNotificationRow[]; unread: number }>('/api/supplier/notifications?limit=20')
      setItems(res.items ?? [])
      if ((Number(res.unread) || 0) > 0) {
        await supplierApi.post('/api/supplier/notifications/read-all').catch(() => { /* 다음 열람 때 재시도 */ })
      }
      setUnread(0)
    } catch {
      toast.error(t('supplier.notifLoadFail', { defaultValue: '알림을 불러오지 못했습니다' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={openPanel} aria-label={t('supplier.notifications', { defaultValue: '알림' })}
        className="relative flex items-center text-gray-700 hover:text-gray-900 p-1">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-[13px] font-bold text-gray-900">
            {t('supplier.notifications', { defaultValue: '알림' })}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300 mx-auto" /></div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-gray-400">{t('supplier.notifEmpty', { defaultValue: '알림이 없습니다' })}</p>
            ) : (
              items.map(n => (
                <button key={n.id}
                  onClick={() => { setOpen(false); if (n.link) onNavigate(n.link) }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 ${n.is_read ? '' : 'bg-red-50/40'}`}>
                  <p className="text-[13px] font-semibold text-gray-900 leading-snug">{n.title}</p>
                  {n.message && <p className="text-[12px] text-gray-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{(n.created_at || '').replace('T', ' ').slice(0, 16)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
