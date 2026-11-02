/**
 * 🏠 받은 견적 비교 (2026-10-24 대표 확정).
 * 견적 카드에 금액·한마디·그 사장님이 정가로 파는 이용권을 함께 보여 준다.
 * 손님이 고르면 그 한 곳과만 서로 연락처가 공개된다(고르기 전엔 누구에게도 번호가 가지 않는다).
 * 처음 이 화면을 연 순간이 '견적을 열어 봄' 이다 — 서버가 기록하고, 48시간 미열람 반환 판정에 쓴다.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { categoryDef, quotePriceText, type HomeServiceCategory } from '@/shared/home-service'
import { formatNumber } from '@/utils/format'
import { BigTicketNote, DetailRows, LifeHeader, STATUS_LABEL, categoryLabel, shareLifeRequest } from './life-shared'
import { ProProfileBlock, RatingLine, ReviewForm, type ProLink, type ReviewSummary } from './life-reviews'
import QuoteChat from './QuoteChat'

interface Voucher { id: number; name: string; price?: number }
interface Quote { id: number; seller_id: number; msg_count?: number; price: number | null; message: string; status: string; pro_name: string; pro_phone: string | null; vouchers: Voucher[]; is_house?: number | null; partner?: number | null; verified?: number | null
  pro_intro?: string | null; pro_links?: ProLink[]; reviews?: ReviewSummary | null }
interface Detail {
  id: number; category: string; details: Record<string, string>; desired_date: string; status: string
  quote_count: number; max_quotes: number; quotes: Quote[]; share_token?: string | null
  my_review?: { rating: number; body: string; photos?: string[] } | null
}

export default function LifeRequestDetailPage() {
  const { id } = useParams()
  const [d, setD] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // 질문 창은 한 번에 하나만 연다 — 열린 창만 20초마다 새 줄을 확인한다.
  const [chatOpen, setChatOpen] = useState<number | null>(null)

  const load = useCallback(() => {
    api.get(`/api/home-service/requests/${id}`)
      .then((r) => setD(r.data?.data || null))
      .catch(() => setFailed(true))
  }, [id])
  useEffect(load, [load])

  async function choose(q: Quote) {
    const ok = await confirmDialog({ title: `${q.pro_name}을(를) 고를까요?`, message: '고르면 이 사장님과 서로 연락처가 공개되고, 다른 견적은 더 고를 수 없어요.', confirmText: '고르기' })
    if (!ok) return
    setBusy(true)
    try {
      const r = await api.post(`/api/home-service/requests/${id}/choose`, { quote_id: q.id })
      if (r.data?.success) { toast.success('사장님에게 연락처가 전달됐어요'); load() } else toast.error(r.data?.error || '고르지 못했어요')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '고르지 못했어요')
    } finally { setBusy(false) }
  }

  async function cancel() {
    const ok = await confirmDialog({ title: '요청을 취소할까요?', message: '더 이상 견적을 받지 않아요.', confirmText: '취소하기', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/home-service/requests/${id}/cancel`)
      load()
    } catch { toast.error('취소하지 못했어요') } finally { setBusy(false) }
  }

  if (failed) return <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-[13px] text-tone-bad">요청을 불러오지 못했어요.</div>
  if (!d) return <BrandLoader fullScreen label="견적을 불러오는 중" />

  const chosen = d.quotes.find((q) => q.status === 'chosen')
  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="받은 견적 - 유어딜" description="받은 견적을 비교하고 고르세요" url={`/life/requests/${d.id}`} />
      <LifeHeader title={`${categoryLabel(d.category)} 견적`} back="/life/requests" />
      <div className="ur-content-narrow space-y-4 px-4 pb-10">
        <section className="rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-brand-text">{STATUS_LABEL[d.status] || d.status}</span>
            <span className="text-[13px] text-gray-500 dark:text-gray-400">받은 견적 {d.quote_count} / {d.max_quotes}</span>
          </div>
          <DetailRows category={d.category} details={d.details} />
          {categoryDef(d.category as HomeServiceCategory)?.bigTicket && <div className="mt-3 border-t border-rule pt-3"><BigTicketNote /></div>}
        </section>

        {chosen && (
          <section className="rounded-2xl p-5">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">고른 사장님</p>
            <p className="mt-1 text-[17px] font-bold">{chosen.pro_name}</p>
            {chosen.pro_phone && <a href={`tel:${chosen.pro_phone}`} className="ur-btn ur-btn-lg ur-btn-primary mt-3 flex w-full justify-center">{chosen.pro_phone} 전화하기</a>}
            {d.status === 'chosen' && <ReviewForm requestId={d.id} mine={d.my_review ?? null} onDone={load} />}
          </section>
        )}

        {d.quotes.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">
            {d.status === 'open' ? '근처 사장님에게 요청을 보냈어요. 견적이 오면 카카오톡으로 알려 드려요.' : '받은 견적이 없어요.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {d.quotes.map((q) => (
              <li key={q.id} className={`rounded-2xl p-5 ${q.status === 'chosen' ? 'ring-2 ring-brand' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-bold">{q.is_house ? q.pro_name : <Link to={`/life/biz/${q.seller_id}`} className="underline decoration-rule underline-offset-4">{q.pro_name}</Link>}{q.is_house ? <span className="ml-2 rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">{q.partner ? '유어딜 제휴' : '유어딜 직영'}</span> : q.verified ? <span className="ml-2 rounded-full bg-warm px-2 py-1 text-[12px] font-medium text-gray-600 dark:text-gray-300">사업자 인증</span> : null}</span>
                  <span className="text-[17px] font-bold">{quotePriceText(q.price)}</span>
                </div>
                {!q.is_house && <div className="mt-1"><RatingLine r={q.reviews} /></div>}
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">{q.message}</p>
                <ProProfileBlock intro={q.pro_intro} links={q.pro_links} reviews={q.reviews} />
                {q.vouchers.length > 0 && (
                  <div className="mt-3 border-t border-rule pt-2">
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">이 사장님의 정찰가 이용권</p>
                    {q.vouchers.slice(0, 2).map((v) => (
                      <Link key={v.id} to={`/pass/${v.id}`} className="flex justify-between gap-3 py-2 text-[13px]">
                        <span className="truncate">{v.name}</span><b className="shrink-0">{formatNumber(v.price)}원</b>
                      </Link>
                    ))}
                  </div>
                )}
                {(d.status === 'open' || q.status === 'chosen' || (q.msg_count ?? 0) > 0) && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <button type="button" onClick={() => setChatOpen(chatOpen === q.id ? null : q.id)} className="text-[13px] font-medium text-brand-text">
                      {chatOpen === q.id ? '질문 닫기' : `사장님께 질문하기${q.msg_count ? ` (${q.msg_count})` : ''}`}
                    </button>
                    {chatOpen === q.id && (
                      <QuoteChat base={`/api/home-service/requests/${d.id}/quotes/${q.id}/messages`} me="customer"
                        canSend={d.status === 'open' || q.status === 'chosen'} otherName={q.pro_name} />
                    )}
                  </div>
                )}
                {d.status === 'open' && (
                  <button type="button" disabled={busy} onClick={() => choose(q)} className="ur-btn ur-btn-lg ur-btn-primary mt-4 flex w-full justify-center disabled:opacity-60">
                    이 사장님 고르기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {d.status === 'open' && d.share_token && (
          <section className="rounded-2xl p-5">
            <p className="text-[15px] font-bold">아는 업체가 있나요?</p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">링크를 보내면 그 업체가 바로 가입해 견적을 보낼 수 있어요. 이름·연락처·상세 주소는 가려져요.</p>
            <button type="button" onClick={() => shareLifeRequest(d.share_token!, `${categoryLabel(d.category)} 견적 요청`)}
              className="ur-btn ur-btn-lg mt-3 flex w-full justify-center bg-warm text-ink">요청 링크 보내기</button>
          </section>
        )}

        {d.status === 'open' && (
          <button type="button" disabled={busy} onClick={cancel} className="block w-full py-3 text-center text-[13px] text-gray-500 dark:text-gray-400">
            요청 취소하기
          </button>
        )}
      </div>
    </div>
  )
}
