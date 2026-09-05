/**
 * 🧱 2026-09-02 (file-size 래칫 — 유어샵 안3/안P1 구현): `CuratorPage.tsx` 에서 **그대로 추출** — 동작·마크업 불변.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { curatorApi, type CuratorPin } from '@/features/curator/api/curator-api'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'

// 🎨 2026-06-16 유어샵 시안: 본인 핀 관리 리스트 — 드래그(터치+마우스) 정렬 + 핀별 통계 + 코멘트 넛지 + 삭제.
//   드래그 라이브러리 없이 pointer 이벤트로 구현 (window 리스너 + ref, 모바일 스크롤 방지 touch-action:none).
export default function PinManageList({ pins, onReorder, onDeleted }: { pins: CuratorPin[]; onReorder: (next: CuratorPin[]) => void; onDeleted: (id: number) => void }) {
  const { t } = useTranslation()
  const [items, setItems] = useState<CuratorPin[]>(pins)
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => { setItems(pins) }, [pins])
  const dragIdxRef = useRef<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function reorderTo(clientY: number) {
    const container = listRef.current
    const from = dragIdxRef.current
    if (!container || from == null) return
    const rows = Array.from(container.querySelectorAll('[data-pinrow]')) as HTMLElement[]
    let target = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) { target = i; break }
    }
    if (target !== from) {
      setItems(prev => {
        const next = [...prev]
        const [m] = next.splice(from, 1)
        next.splice(target, 0, m)
        return next
      })
      dragIdxRef.current = target
    }
  }
  useEffect(() => {
    function onMove(e: PointerEvent) { if (dragIdxRef.current != null) { e.preventDefault(); reorderTo(e.clientY) } }
    function onUp() {
      if (dragIdxRef.current == null) return
      dragIdxRef.current = null
      setDraggingId(null)
      const finalItems = itemsRef.current
      onReorder(finalItems)
      curatorApi.reorderPins(finalItems.map(p => p.id)).catch(() => { /* best-effort */ })
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [onReorder])

  async function del(id: number) {
    const ok = await confirmDialog({ message: t('curator.confirmDeletePin', { defaultValue: '이 핀을 삭제할까요?' }), danger: true })
    if (!ok) return
    try {
      const r = await curatorApi.removePin(id)
      if (r?.success) { setItems(prev => prev.filter(p => p.id !== id)); onDeleted(id); toast.success(t('curator.pinDeleted', { defaultValue: '핀 삭제됨' })) }
      else toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' }))
    } catch { toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' })) }
  }

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-6">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">{t('curator.myPinsCount', { defaultValue: '내 핀 {{count}}개', count: items.length })}</span>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">⇅ {t('curator.dragToReorder', { defaultValue: '끌어서 정렬' })}</span>
      </div>
      <div ref={listRef} className="flex flex-col gap-2.5">
        {items.map((pin, idx) => {
          const img = pin.thumbnail || pin.image_url || ''
          const est = pin.commission_rate > 0 ? Math.round(pin.price * pin.commission_rate / 100) : 0
          const dragging = draggingId === pin.id
          return (
            <div
              key={pin.id}
              data-pinrow
              className={`flex items-center gap-3 rounded-2xl border p-2.5 bg-white dark:bg-[#1D1F29] ${dragging ? 'border-[#6b7280] shadow-lg' : 'border-gray-200 dark:border-[#2C2F35]'}`}
              style={{ opacity: dragging ? 0.92 : 1 }}
            >
              <span
                onPointerDown={(e) => { e.preventDefault(); dragIdxRef.current = idx; setDraggingId(pin.id) }}
                style={{ touchAction: 'none', cursor: 'grab' }}
                className="text-gray-300 dark:text-gray-600 text-lg px-1 select-none leading-none"
                aria-label={t('curator.dragToReorder', { defaultValue: '끌어서 정렬' })}
              >⋮⋮</span>
              {img
                ? <img src={cfImage(img, { width: 100, format: 'auto' }) || img} alt="" className="w-[52px] h-[52px] rounded-xl object-cover shrink-0" loading="lazy" decoding="async" onError={(e) => cfImageOnError(e.currentTarget, img)} />
                : <div className="w-[52px] h-[52px] rounded-xl bg-gray-100 dark:bg-[#1D1F29] shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{pin.product_name}</span>
                  {idx === 0 && <span className="shrink-0 text-[9.5px] font-extrabold text-[#6b7280] bg-[#FFEDE8] dark:bg-[#2a1812] px-1.5 py-0.5 rounded">{t('curator.topPick', { defaultValue: '강추' })}</span>}
                </div>
                {pin.note
                  ? <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">{t('curator.viewsCount', { defaultValue: '조회 {{n}}', n: fmtK(pin.click_count || 0) })}{est > 0 ? t('curator.earnPerSaleAmt', { defaultValue: ' · 쓰면 ₩{{amt}}', amt: est.toLocaleString('ko-KR') }) : ''}</div>
                  : <div className="text-[11.5px] font-semibold text-[#C2491F] dark:text-[#9ca3af] mt-1">{t('curator.noCommentNudge', { defaultValue: '추천 코멘트 없음 · 추가하면 전환 ↑' })}</div>}
              </div>
              <button onClick={() => del(pin.id)} aria-label={t('curator.delete', { defaultValue: '삭제' })} className="shrink-0 w-[30px] h-[30px] rounded-lg bg-gray-100 dark:bg-[#1D1F29] text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-sm font-bold">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

