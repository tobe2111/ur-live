import { useTranslation } from 'react-i18next'
import { formatKSTDate } from '@/utils/date'
import type { Stream } from './types'

const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

interface Props {
  streams: Stream[]
  loading: boolean
  onDelete: (id: number) => void
}

/**
 * 어드민 라이브 스트림 관리 테이블.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function StreamsTable({ streams, loading, onDelete }: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
        <h2 className="text-sm font-semibold text-gray-900">{t('admin.dashboard.k058', { defaultValue: '라이브 스트림 관리' })}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {['ID', t('admin.dashboard.k059', { defaultValue: '제목' }), 'YouTube ID', t('admin.dashboard.k047', { defaultValue: '상태' }), t('admin.dashboard.k060', { defaultValue: '생성일' }), t('admin.dashboard.k049', { defaultValue: '액션' })].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && streams.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skel-s-${i}`}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skel className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : streams.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">{t('admin.dashboard.k061', { defaultValue: '등록된 라이브가 없습니다' })}</td></tr>
            ) : streams.map(stream => (
              <tr key={stream.id} className="hover:bg-gray-50">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
