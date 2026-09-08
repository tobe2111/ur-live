/**
 * ✉️ 입점 제안 문구 모달 — 제목/본문/문자 초안 복사 + mailto. 발송은 대표가 직접(수집 ≠ 발송). z-index 표준(모달 10500).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Draft { subject: string; body: string; sms: string; register_url: string; store: { biz_name: string; email?: string | null; phone?: string | null } }

export default function ProposalModal({ prospectId, email, phone, onClose }: { prospectId: number; email: string | null; phone: string | null; onClose: () => void }) {
  const [d, setD] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    api.get(`/api/admin/store-prospects/${prospectId}/proposal`)
      .then(r => { if (alive && r.data?.success) setD(r.data) })
      .catch(() => { if (alive) toast.error('제안 문구를 불러오지 못했습니다') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [prospectId])
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} 복사됨`) } catch { toast.error('복사 실패 — 직접 선택해 주세요') }
  }
  return (
    <div className="fixed inset-0 z-[10500] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-gray-900">입점 제안 문구 초안</div>
            <div className="text-[12px] text-gray-500 mt-0.5">사실(매장·업종·지역)과 어드민 요율만 넣은 초안입니다. 다듬어서 대표가 직접 보냅니다.</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">닫기</button>
        </div>
        {loading ? <div className="py-8 text-center text-sm text-gray-400">불러오는 중…</div> : !d ? null : (
          <div className="mt-4 space-y-4 text-[13px]">
            <div>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-gray-700">제목</span><button onClick={() => copy(d.subject, '제목')} className="text-xs text-blue-600 underline">복사</button></div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-900">{d.subject}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-gray-700">본문 (이메일·카톡)</span><button onClick={() => copy(d.body, '본문')} className="text-xs text-blue-600 underline">복사</button></div>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-900 font-sans leading-relaxed">{d.body}</pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-gray-700">문자 (SMS)</span><button onClick={() => copy(d.sms, '문자')} className="text-xs text-blue-600 underline">복사</button></div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-900">{d.sms}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {email && <a href={`mailto:${email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">메일 앱으로 열기</a>}
              {phone && <a href={`sms:${phone}?body=${encodeURIComponent(d.sms)}`} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-semibold">문자 앱으로 열기</a>}
              <span className="text-[11px] text-gray-400 self-center">등록 링크 {d.register_url}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
