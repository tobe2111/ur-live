import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import type { Stream } from './types'

const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

interface Props {
  streams: Stream[]
  loading: boolean
  onDelete: (id: number) => void
  // 🛡️ 2026-06-17: 체크박스 일괄 삭제 — true 반환 시(실제 삭제됨) 선택 초기화.
  onBulkDelete?: (ids: number[]) => Promise<boolean>
}

/**
 * 어드민 라이브 스트림 관리 테이블.
 * 🛡️ TD-006 추출 (2026-05-06).
 * 🛡️ 2026-06-17: 체크박스 다중 선택 + 일괄 삭제 (라이브 모니터와 동일 UX).
 */
export default function StreamsTable({ streams, loading, onDelete, onBulkDelete }: Props) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // streams 갱신(삭제 후 refetch) 시 더 이상 존재하지 않는 선택 항목 정리.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(streams.map((s) => s.id))
      let changed = false
      const next = new Set<number>()
      prev.forEach((id) => { if (valid.has(id)) next.add(id); else changed = true })
      return changed ? next : prev
    })
  }, [streams])

  const allSelected = streams.length > 0 && selectedIds.size === streams.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < streams.length

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(streams.map((s) => s.id)))
  }
  async function handleBulkDelete() {
    if (selectedIds.size === 0 || !onBulkDelete) return
    setBulkDeleting(true)
    try {
      const ok = await onBulkDelete(Array.from(selectedIds))
      if (ok) setSelectedIds(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('admin.dashboard.k058', { defaultValue: '라이브 스트림 관리' })}</h2>
        {/* 🛡️ 2026-06-17: 일괄 삭제 액션 바 — 1건 이상 선택 시 노출. */}
        {onBulkDelete && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">{t('admin.dashboard.k064', { defaultValue: `${selectedIds.size}건 선택됨` })}</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              {t('admin.dashboard.k065', { defaultValue: '선택 해제' })}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3" /> {bulkDeleting ? t('admin.dashboard.k066', { defaultValue: '삭제 중...' }) : t('admin.dashboard.k067', { defaultValue: `${selectedIds.size}건 일괄 삭제` })}
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {/* 🛡️ 2026-06-17: 전체 선택 체크박스. */}
              {onBulkDelete && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleSelectAll}
                    disabled={streams.length === 0}
                    aria-label={t('admin.dashboard.k068', { defaultValue: '전체 선택' })}
                    className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
              )}
              {['ID', t('admin.dashboard.k059', { defaultValue: '제목' }), 'YouTube ID', t('admin.dashboard.k047', { defaultValue: '상태' }), t('admin.dashboard.k060', { defaultValue: '생성일' }), t('admin.dashboard.k049', { defaultValue: '액션' })].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && streams.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skel-s-${i}`}>
                  {Array.from({ length: onBulkDelete ? 7 : 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skel className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : streams.length === 0 ? (
              <tr><td colSpan={onBulkDelete ? 7 : 6} className="px-4 py-8 text-center text-sm text-gray-400">{t('admin.dashboard.k061', { defaultValue: '등록된 라이브가 없습니다' })}</td></tr>
            ) : streams.map(stream => {
              const checked = selectedIds.has(stream.id)
              return (
                <tr key={stream.id} className={`hover:bg-gray-50 ${checked ? 'bg-red-50/40' : ''}`}>
                  {onBulkDelete && (
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(stream.id)}
                        aria-label={t('admin.dashboard.k069', { defaultValue: `"${stream.title}" 선택` })}
                        className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-gray-500">{stream.id}</td>
                  <td className="px-4 py-3 text-xs text-gray-900">{stream.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{stream.youtube_video_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      stream.status === 'live' ? 'bg-red-50 text-red-600' :
                      stream.status === 'scheduled' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {stream.status === 'live' ? t('admin.dashboard.k062', { defaultValue: '🔴 라이브' }) : stream.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatKSTDate(stream.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onDelete(stream.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('admin.dashboard.k063', { defaultValue: '삭제' })}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
