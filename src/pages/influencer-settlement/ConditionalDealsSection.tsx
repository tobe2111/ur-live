/**
 * 🎬 WP-B (2026-07-12) 조건부 우대 커미션 — 인플루언서 표면.
 *   매장이 '콘텐츠 게시 인증 시 발효' 조건으로 우대 커미션을 제안하면(requires_content_proof=1),
 *   인플이 여기서 콘텐츠(블로그/SNS) 링크를 제출한다. 매장이 승인(approve-proof)하면 발효(status='active').
 *
 * 백엔드(marketing.routes.ts influencerApp, 마운트 /api/influencer-settlement):
 *   GET  /deals                    — 내게 온 제안 목록(인증 상태 포함)
 *   POST /deals/:id/submit-proof   — {proof_url} 콘텐츠 링크 제출
 *
 * ⚠️ 머니 무접촉: 우대율 발효는 매장 승인의 status='active' 게이트로만(기존 메커니즘). 이 화면은
 *   링크 제출만 — 요율/정산/적립 계산 없음. 미조건부(requires_content_proof=0) 제안은 미표시.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Sparkles, ExternalLink } from 'lucide-react'

interface InfDeal {
  id: number
  seller_id: number
  commission_pct: number
  ends_at: string | null
  status: string
  proposed_by: string
  message: string | null
  created_at: string
  requires_content_proof?: number | null
  proof_url?: string | null
  proof_status?: string | null
}

export default function ConditionalDealsSection() {
  const [deals, setDeals] = useState<InfDeal[]>([])
  const [loaded, setLoaded] = useState(false)
  const [urlById, setUrlById] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  function load() {
    api.get('/api/influencer-settlement/deals')
      .then((r) => {
        if (r.data?.success) {
          const all = (r.data.data || []) as InfDeal[]
          // 조건부(requires_content_proof=1) 제안만 노출 — 무조건부 딜은 이 섹션 대상 아님
          setDeals(all.filter((d) => d.requires_content_proof === 1))
        }
      })
      .catch(() => { /* 섹션 로드 실패는 조용히 — 정산 화면 본체는 계속 동작 */ })
      .finally(() => setLoaded(true))
  }

  async function submitProof(deal: InfDeal) {
    const url = (urlById[deal.id] || '').trim()
    if (!/^https:\/\/[^\s]{5,500}$/i.test(url)) {
      toast.error('유효한 https 콘텐츠 링크를 입력해주세요')
      return
    }
    setSubmitting(deal.id)
    try {
      const r = await api.post(`/api/influencer-settlement/deals/${deal.id}/submit-proof`, { proof_url: url })
      if (r.data?.success) {
        toast.success('콘텐츠 링크를 제출했습니다 — 매장 승인 시 우대 커미션이 발효됩니다')
        setUrlById((m) => ({ ...m, [deal.id]: '' }))
        load()
      } else {
        toast.error(r.data?.error || '제출에 실패했습니다')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '제출에 실패했습니다')
    } finally {
      setSubmitting(null)
    }
  }

  // 표시할 조건부 딜이 없으면 섹션 자체를 숨김(빈 카드 노이즈 방지)
  if (!loaded || deals.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#0A0A0A] border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">조건부 우대 커미션 제안</h3>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        매장이 <b>콘텐츠 게시 인증 시 발효</b> 조건으로 우대 커미션을 제안했습니다. 블로그/SNS에 콘텐츠를
        게시한 뒤 링크를 제출하면, 매장 확인 후 우대율이 발효됩니다 (발효 이후 판매분부터 적용).
      </p>
      <div className="space-y-2.5">
        {deals.map((d) => {
          const ps = d.proof_status
          const canSubmit = d.status === 'proposed' && (ps === 'pending' || ps === 'rejected')
          return (
            <div key={d.id} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  매장 #{d.seller_id} · {d.commission_pct}%
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  d.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : ps === 'submitted'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : ps === 'rejected'
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {d.status === 'active'
                    ? '발효됨'
                    : ps === 'submitted'
                      ? '매장 검토 중'
                      : ps === 'rejected'
                        ? '반려됨 · 재제출'
                        : '링크 제출 대기'}
                </span>
              </div>
              {d.message && <p className="mt-1 text-[11px] italic text-gray-500 dark:text-gray-400">&ldquo;{d.message}&rdquo;</p>}
              {d.proof_url && (
                <a href={d.proof_url} target="_blank" rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> 제출한 콘텐츠 보기
                </a>
              )}
              {canSubmit && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={urlById[d.id] || ''}
                    onChange={(e) => setUrlById((m) => ({ ...m, [d.id]: e.target.value }))}
                    placeholder="https://blog.naver.com/..."
                    className="flex-1 rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={submitting === d.id}
                    onClick={() => submitProof(d)}
                    className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {submitting === d.id ? '제출 중...' : ps === 'rejected' ? '재제출' : '제출'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
