/**
 * ⭐ 생활 견적 후기 · 업체 소개 조각 (2026-10-26 대표 "숨고·미소 링크 · 후기 기능")
 * 규칙 SSOT `@/shared/home-service-review`. 견적 비교 화면과 사장님 화면이 같이 쓴다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKSTDate } from '@/utils/date'
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, ratingText } from '@/shared/home-service-review'

export interface ReviewSummary { avg: number | null; count: number; recent: { rating: number; body: string; reviewer: string; created_at: string }[] }
export interface ProLink { url: string; label: string }

/** 별점 요약 한 줄 — 후기가 없으면 '첫 후기 전' 으로(0점처럼 보이지 않게). */
export function RatingLine({ r }: { r: ReviewSummary | null | undefined }) {
  const t = r ? ratingText(r.avg, r.count) : null
  return <span className="text-[13px] text-gray-500 dark:text-gray-400">{t ? <b className="text-ink">{t}</b> : '유어딜 후기 아직 없음'}</span>
}

/** 업체 소개 + 다른 곳 후기 링크 + 최근 후기 — 견적 카드 안. */
export function ProProfileBlock({ intro, links, reviews }: { intro?: string | null; links?: ProLink[]; reviews?: ReviewSummary | null }) {
  const [open, setOpen] = useState(false)
  const recent = reviews?.recent ?? []
  if (!intro && !links?.length && !recent.length) return null
  return (
    <div className="mt-3 space-y-2 border-t border-rule pt-3">
      {intro && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">{intro}</p>}
      {!!links?.length && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
              className="rounded-full bg-warm px-3 py-1 text-[12px] font-medium text-ink">{l.label} 후기 보기</a>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen(!open)} className="text-[13px] font-medium text-brand-text">
            유어딜 후기 {reviews?.count ?? recent.length}개 {open ? '접기' : '보기'}
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {recent.map((v, i) => (
                <li key={i} className="rounded-xl bg-warm p-3">
                  <p className="text-[12px] text-gray-500 dark:text-gray-400"><b className="text-ink">{'★'.repeat(v.rating)}</b> {v.reviewer} · {formatKSTDate(v.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-700 dark:text-gray-200">{v.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** 고른 뒤 — 후기 쓰기(한 번). 이미 썼으면 내 후기를 보여 준다. */
export function ReviewForm({ requestId, mine, onDone }: {
  requestId: number; mine: { rating: number; body: string } | null; onDone: () => void
}) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  if (mine) {
    return (
      <div className="mt-4 border-t border-rule pt-3">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">내 후기</p>
        <p className="mt-1 text-[15px] font-bold">{'★'.repeat(mine.rating)}</p>
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-700 dark:text-gray-200">{mine.body}</p>
      </div>
    )
  }

  async function submit() {
    setBusy(true)
    try {
      const r = await api.post(`/api/home-service/requests/${requestId}/review`, { rating, body })
      if (r.data?.success) { toast.success('후기를 남겼어요. 고마워요'); onDone() } else toast.error(r.data?.error || '남기지 못했어요')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '남기지 못했어요')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-4 border-t border-rule pt-3">
      <p className="text-[15px] font-bold">일은 어떠셨어요?</p>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">후기는 다음 손님이 업체를 고를 때 보여요.</p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`} onClick={() => setRating(n)}
            className={`text-[28px] leading-none ${n <= rating ? 'text-brand-text' : 'text-gray-300 dark:text-gray-600'}`}>★</button>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={REVIEW_BODY_MAX} rows={3}
        placeholder="시간 약속, 일 솜씨, 가격이 견적과 같았는지 적어 주세요"
        className="mt-3 w-full rounded-xl border border-rule bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-brand" />
      <button type="button" disabled={busy || rating === 0 || body.trim().length < REVIEW_BODY_MIN} onClick={submit}
        className="ur-btn ur-btn-lg ur-btn-primary mt-3 flex w-full justify-center disabled:opacity-60">후기 남기기</button>
    </div>
  )
}
