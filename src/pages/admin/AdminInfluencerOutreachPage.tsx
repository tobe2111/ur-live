/**
 * 📣 어드민 — 인플루언서 제안 발송 큐 (알림 링크 /admin/influencer-outreach 의 착지 화면)
 *   셀러 제안을 검토하고, 타깃별 [연락처 + 수락 URL] 을 복사해 유어딜이 직접 발송한다.
 *   발송 자동화 없음(대표 방침) — 이 화면은 발송 재료를 모아 주는 것까지.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatKSTShort } from '@/utils/date'

interface OutreachRow {
  id: number; seller_id: number; seller_name: string | null; product_id: number | null; product_name: string | null
  target_count: number; commission_pct: number; product_support: string; channels: string
  period_days: number | null; message: string; status: string; quoted_fee_krw: number; admin_note: string | null; created_at: string
}
interface Target {
  id: number; platform: string; handle: string; name: string | null; category: string | null
  email: string | null; subscriber_count: number | null; url: string | null
  accept_url: string | null; invite_status: string; accepted_user_id: string | null
}

const STATUS_LABEL: Record<string, string> = { submitted: '접수됨', approved: '검토 완료', sent: '발송 완료', rejected: '반려' }

export default function AdminInfluencerOutreachPage() {
  const [rows, setRows] = useState<OutreachRow[]>([])
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    setError(false)
    api.get('/api/admin/influencer-outreach')
      .then((r) => setRows(r.data?.data || []))
      .catch(() => setError(true))
  }, [])
  useEffect(() => { load() }, [load])

  const openDetail = (id: number) => {
    setOpenId(id); setTargets([]); setDetailLoading(true)
    api.get(`/api/admin/influencer-outreach/${id}`)
      .then((r) => setTargets(r.data?.data?.targets || []))
      .catch(() => setTargets([]))
      .finally(() => setDetailLoading(false))
  }

  const setStatus = (id: number, status: string) => {
    api.post(`/api/admin/influencer-outreach/${id}/status`, { status }).then(load).catch(() => {})
  }

  const copyAll = () => {
    const lines = targets.filter((t) => t.accept_url).map((t) =>
      `${t.name || t.handle} <${t.email || '이메일 없음'}> — 수락링크: ${t.accept_url}`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">인플루언서 제안 발송 큐</h1>
        <p className="text-sm text-gray-500 mt-1">셀러가 접수한 제안이에요. 타깃별 수락 링크를 복사해 발송하고, 처리 상태를 남겨 주세요.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          목록을 불러오지 못했어요. <button className="underline" onClick={load}>다시 시도</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.length === 0 && !error && (
          <div className="p-6 text-sm text-gray-400 text-center">접수된 제안이 없어요.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm">
                  #{r.id} {r.seller_name || `셀러 ${r.seller_id}`} — {r.product_name || '상품 미지정'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {r.target_count}명 · 커미션 {r.commission_pct}% · {r.product_support === 'free' ? '무상 제공' : '유상'} ·
                  {' '}{(() => { try { return (JSON.parse(r.channels) as string[]).join(', ') } catch { return r.channels } })()}
                  {' '}· {formatKSTShort(r.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'submitted' ? 'bg-amber-100 text-amber-800' : r.status === 'sent' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                <button className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700" onClick={() => openDetail(r.id)}>타깃 보기</button>
                {r.status === 'submitted' && (
                  <>
                    <button className="text-xs px-2 py-1 rounded bg-gray-900 text-white" onClick={() => setStatus(r.id, 'sent')}>발송 완료로</button>
                    <button className="text-xs px-2 py-1 rounded border border-red-300 text-red-600" onClick={() => setStatus(r.id, 'rejected')}>반려</button>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2 whitespace-pre-wrap line-clamp-3">{r.message}</div>

            {openId === r.id && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">타깃 {targets.length}명 (연락처는 어드민 전용)</span>
                  <button className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700" onClick={copyAll}>전체 복사</button>
                </div>
                {detailLoading ? (
                  <div className="text-xs text-gray-400 py-2">불러오는 중…</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-gray-500">
                        <th className="py-1 pr-2">이름/핸들</th><th className="py-1 pr-2">이메일</th>
                        <th className="py-1 pr-2">팔로워</th><th className="py-1 pr-2">수락 링크</th><th className="py-1">수락</th>
                      </tr></thead>
                      <tbody>
                        {targets.map((t) => (
                          <tr key={t.id} className="border-t border-gray-200">
                            <td className="py-1.5 pr-2 text-gray-900">{t.name || t.handle}</td>
                            <td className="py-1.5 pr-2 text-gray-700">{t.email || <span className="text-gray-400">없음</span>}</td>
                            <td className="py-1.5 pr-2 text-gray-700">{(t.subscriber_count || 0).toLocaleString()}</td>
                            <td className="py-1.5 pr-2">
                              {t.accept_url ? (
                                <button className="text-blue-600 underline" onClick={() => navigator.clipboard?.writeText(t.accept_url!).catch(() => {})}>복사</button>
                              ) : '—'}
                            </td>
                            <td className="py-1.5">{t.invite_status === 'accepted' ? <span className="text-green-600 font-semibold">수락됨</span> : '대기'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
