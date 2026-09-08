/**
 * 📥 결재 카드의 "대표 답" 입력 상자 (2026-09-08 대표 "어드민으로 해").
 *   번호 버튼 하나 또는 한 줄 → POST /api/admin/decisions/:slug/answer → D1 우편함.
 *   파일(SSOT) 반영은 커넥터 대리인 루틴(4시간)이 한다 — 여기서는 "반영 대기" 상태만 보여 준다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export interface PendingAnswer {
  slug: string
  answer: string
  answered_by: string | null
  answered_at: string
  synced_at: string | null
  synced_ref: string | null
}

export default function AnswerBox({
  slug, options, pending, onSaved,
}: {
  slug: string
  options: string[]
  pending: PendingAnswer | null
  onSaved: (p: PendingAnswer) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(answer: string) {
    const a = answer.trim()
    if (!a || busy) return
    setBusy(true)
    try {
      const res = await api.post(`/api/admin/decisions/${encodeURIComponent(slug)}/answer`, { answer: a })
      if (!res.data?.success) throw new Error(res.data?.error || 'save failed')
      onSaved({ slug, answer: a, answered_by: res.data.answered_by ?? null, answered_at: new Date().toISOString(), synced_at: null, synced_ref: null })
      setText('')
      toast.success('답을 저장했습니다. 4시간 안에 결재 파일에 반영되고 구현이 시작됩니다.')
    } catch {
      toast.error('답을 저장하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      {pending && (
        <div className="mb-2 rounded-xl bg-blue-50 px-3 py-2 text-[13px] text-blue-900">
          <span className="font-bold">어드민에서 답함:</span> {pending.answer}
          <span className="ml-2 text-[11px] text-blue-700">
            {pending.synced_at ? `· 파일 반영됨 (${pending.synced_ref ?? ''})` : '· 파일 반영 대기(다음 동기화 ≤ 4시간)'}
          </span>
        </div>
      )}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => save(String(i + 1))}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {i + 1}번
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => save('기본안대로')}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            기본안대로
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(text) }}
          maxLength={500}
          placeholder="또는 한 줄로 (예: 2번, 단 N=10)"
          className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => save(text)}
          className="px-4 py-2 rounded-xl text-[13px] font-bold bg-gray-900 text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">여기 적은 문장이 그대로 결정 기록이 됩니다(요약·의역 없음). 다시 적으면 덮어씁니다.</p>
    </div>
  )
}
