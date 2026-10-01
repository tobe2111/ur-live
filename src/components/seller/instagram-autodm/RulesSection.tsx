/**
 * 💬 인스타 자동 DM — 규칙 목록 + 편집 + 미리보기(실발송 X). 어드민·셀러 공용(`base` 로 계정이 갈린다).
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { TONE_PILL } from '@/components/ui/status-pill'
import { Plus, Edit2, Trash2, FlaskConical } from 'lucide-react'
import RuleEditor from './RuleEditor'
import { apiError, type AutoDmRule } from './types'

export default function RulesSection({ base, queryKey, connected, onChanged }: {
  base: string; queryKey: string; connected: boolean; onChanged: () => void
}) {
  const [editing, setEditing] = useState<AutoDmRule | 'new' | null>(null)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<{ matched: boolean; dm?: string; public_reply?: string | null } | null>(null)
  const rules = useApiQuery<AutoDmRule[]>([queryKey, 'ig-autodm', 'rules'], `${base}/rules`, {
    select: (r: any) => (r?.success ? r.data || [] : []),
  })

  const done = () => { rules.refetch(); onChanged() }

  const removeRule = async (r: AutoDmRule) => {
    const ok = await confirmDialog({ title: '규칙을 삭제할까요?', message: `키워드 "${r.keywords}"`, confirmText: '삭제', danger: true })
    if (!ok) return
    try { await api.delete(`${base}/rules/${r.id}`); toast.success('삭제했습니다'); done() } catch (e) { toast.error(apiError(e, '삭제하지 못했습니다')) }
  }

  const runTest = async () => {
    try {
      const { data } = await api.post(`${base}/test-match`, { text: testText })
      setTestResult(data?.data || null)
    } catch (e) { toast.error(apiError(e, '테스트에 실패했습니다')) }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500">키워드 규칙</h2>
        {!editing && <Button size="sm" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" /> 규칙 추가</Button>}
      </div>
      {editing && (
        <div className="mb-3">
          <RuleEditor
            base={base}
            rule={editing === 'new' ? null : editing}
            connected={connected}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); done() }}
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
  )
}
