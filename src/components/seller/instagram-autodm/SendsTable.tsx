/**
 * 💬 인스타 자동 DM — 최근 발송 기록. 어드민·셀러 공용.
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { TONE_PILL } from '@/components/ui/status-pill'
import { formatKST } from '@/utils/date'
import type { AutoDmSend } from './types'

const SEND_STATUS: Record<AutoDmSend['status'], { label: string; cls: string }> = {
  sent: { label: '보냄', cls: TONE_PILL.ok },
  failed: { label: '실패', cls: TONE_PILL.bad },
  skipped: { label: '건너뜀', cls: TONE_PILL.warn },
  claimed: { label: '처리 중', cls: TONE_PILL.info },
}

export default function SendsTable({ base, queryKey }: { base: string; queryKey: string }) {
  const sends = useApiQuery<AutoDmSend[]>([queryKey, 'ig-autodm', 'sends'], `${base}/sends?limit=100`, {
    select: (r: any) => (r?.success ? r.data || [] : []),
  })

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-500">최근 발송 기록</h2>
      {sends.isError ? (
        <p className="text-sm text-tone-bad">기록을 불러오지 못했습니다. <button onClick={() => sends.refetch()} className="underline">다시 시도</button></p>
      ) : (sends.data || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-400">아직 기록이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr><th className="px-3 py-2">시각</th><th className="px-3 py-2">계정</th><th className="px-3 py-2">댓글</th><th className="px-3 py-2">상태</th><th className="px-3 py-2">비고</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(sends.data || []).map((s) => {
                const st = SEND_STATUS[s.status] || SEND_STATUS.claimed
                return (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatKST(s.created_at)}</td>
                    <td className="px-3 py-2 text-gray-800">{s.from_username ? `@${s.from_username}` : '-'}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-gray-600" title={s.comment_text || ''}>{s.comment_text}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${st.cls}`}>{st.label}</span></td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-400" title={s.error || s.public_reply_status || ''}>
                      {s.error || (s.public_reply_status ? `공개 답글 ${s.public_reply_status === 'sent' ? '보냄' : s.public_reply_status}` : '')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
