/**
 * 💬 2026-10-01 어드민 — 인스타 댓글 → 자동 DM.
 *   "댓글에 OOO 적어 주세요, 링크 DM 보내드려요" 를 유어딜 공식 계정에서 돌린다.
 *   메타 공식 Private Reply 사용(댓글당 1통 · 댓글 후 7일 이내). 기본 OFF.
 *   ⚠️ 라이트 대시보드 테마(AdminLayout) — dark: variant 금지.
 *   백엔드: /api/admin/instagram-autodm/* (features/instagram-autodm).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Edit2, Trash2, Loader2, AlertTriangle, FlaskConical } from 'lucide-react'
import { formatKST } from '@/utils/date'
import { TONE_PILL } from '@/components/ui/status-pill'
import ConnectPanel from './admin-instagram-autodm/ConnectPanel'
import RuleEditor from './admin-instagram-autodm/RuleEditor'
import { apiError, type AutoDmRule, type AutoDmSend, type AutoDmStatus } from './admin-instagram-autodm/types'

const SEND_STATUS: Record<AutoDmSend['status'], { label: string; cls: string }> = {
  sent: { label: '보냄', cls: TONE_PILL.ok },
  failed: { label: '실패', cls: TONE_PILL.bad },
  skipped: { label: '건너뜀', cls: TONE_PILL.warn },
  claimed: { label: '처리 중', cls: TONE_PILL.info },
}

export default function AdminInstagramAutoDmPage() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<AutoDmRule | 'new' | null>(null)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<{ matched: boolean; dm?: string; public_reply?: string | null } | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const status = useApiQuery<AutoDmStatus>(['admin', 'ig-autodm', 'status'], '/api/admin/instagram-autodm/status', {
    select: (r: any) => r?.data,
  })
  const rules = useApiQuery<AutoDmRule[]>(['admin', 'ig-autodm', 'rules'], '/api/admin/instagram-autodm/rules', {
    select: (r: any) => (r?.success ? r.data || [] : []),
  })
  const sends = useApiQuery<AutoDmSend[]>(['admin', 'ig-autodm', 'sends'], '/api/admin/instagram-autodm/sends?limit=100', {
    select: (r: any) => (r?.success ? r.data || [] : []),
  })

  const refreshAll = () => { status.refetch(); rules.refetch(); sends.refetch() }

  const removeRule = async (r: AutoDmRule) => {
    const ok = await confirmDialog({ title: '규칙을 삭제할까요?', message: `키워드 "${r.keywords}"`, confirmText: '삭제', danger: true })
    if (!ok) return
    try { await api.delete(`/api/admin/instagram-autodm/rules/${r.id}`); toast.success('삭제했습니다'); refreshAll() } catch (e) { toast.error(apiError(e, '삭제하지 못했습니다')) }
  }

  const runTest = async () => {
    try {
      const { data } = await api.post('/api/admin/instagram-autodm/test-match', { text: testText })
      setTestResult(data?.data || null)
    } catch (e) { toast.error(apiError(e, '테스트에 실패했습니다')) }
  }

  return (
    <AdminLayout title="인스타 자동 DM">
      <DashboardPageHeader
        title="인스타 댓글 자동 DM"
        subtitle="정해 둔 키워드로 댓글을 달면 그 사람에게 링크를 DM 으로 보냅니다 (댓글당 1통, 댓글 후 7일 이내)"
      />

      {status.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : status.isError || !status.data ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-tone-bad">
          <AlertTriangle className="h-4 w-4" /> 상태를 불러오지 못했습니다.
          <button onClick={() => status.refetch()} className="ml-2 underline">다시 시도</button>
        </div>
      ) : (
        <div className="space-y-8">
          <ConnectPanel status={status.data} onChange={refreshAll} />

          {/* 규칙 */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-500">③ 키워드 규칙</h2>
              {!editing && <Button size="sm" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" /> 규칙 추가</Button>}
            </div>
            {editing && (
              <div className="mb-3">
                <RuleEditor
                  rule={editing === 'new' ? null : editing}
                  connected={status.data.connected}
                  onClose={() => setEditing(null)}
                  onSaved={() => { setEditing(null); refreshAll() }}
                />
              </div>
            )}
            {rules.isError ? (
              <p className="text-sm text-tone-bad">규칙을 불러오지 못했습니다. <button onClick={() => rules.refetch()} className="underline">다시 시도</button></p>
            ) : (rules.data || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-400">
                아직 규칙이 없습니다. "규칙 추가"로 키워드와 보낼 DM 을 정해 주세요.
              </div>
            ) : (
              <div className="space-y-2">
                {(rules.data || []).map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${r.is_active ? TONE_PILL.ok : TONE_PILL.neutral}`}>
                          {r.is_active ? '사용' : '꺼짐'}
                        </span>
                        {r.name && <span className="text-sm font-medium text-gray-900">{r.name}</span>}
                        <span className="text-xs text-gray-400">{r.media_id ? `게시물 ${r.media_id}` : '모든 게시물'} · {r.match_mode === 'exact' ? '정확히 일치' : '포함'}</span>
                      </div>
                      <p className="text-sm text-gray-800">키워드: <b>{r.keywords}</b></p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-500">{r.dm_text}{r.link_url ? ` → ${r.link_url}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditing(r)} className="rounded p-2 text-gray-500 hover:bg-gray-100" aria-label="수정"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => removeRule(r)} className="rounded p-2 text-tone-bad hover:bg-gray-100" aria-label="삭제"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 미리 보기 — 실제로 보내지 않는다 */}
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <FlaskConical className="h-4 w-4" /> 이 댓글이면 어떤 DM 이 나가나? (실제로 보내지 않음, 모든 게시물 규칙 기준)
              </div>
              <div className="flex gap-2">
                <input
                  value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="예: 링크 주세요!"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
                <Button variant="outline" onClick={runTest} disabled={!testText.trim()}>확인</Button>
              </div>
              {testResult && (
                testResult.matched ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-gray-800">{testResult.dm}</pre>
                    {testResult.public_reply && <p className="text-gray-500">공개 답글: {testResult.public_reply}</p>}
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">맞는 규칙이 없습니다 — DM 이 나가지 않습니다.</p>
              )}
            </div>
          </section>

          {/* 발송 기록 */}
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
        </div>
      )}
    </AdminLayout>
  )
}
