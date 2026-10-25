/**
 * 🏠 사장님 — 요청 상세 · 견적 보내기 (2026-10-24 대표 확정).
 * 금액은 선택(대표 "금액 적지 않아도 참여")이고 비우면 손님에게 "방문 후 견적" 으로 보인다.
 * 참여권 1장 차감과 선착순 자리는 서버가 한 번에 처리한다 — 자리가 없으면 차감되지 않는다.
 * 손님이 이 사장님을 고르면 손님 이름·번호가 여기 뜬다.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { toast } from '@/hooks/useToast'
import { quotePriceText } from '@/shared/home-service'
import { DetailRows, LifeHeader, STATUS_LABEL, categoryLabel, sellerHeaders } from './life-shared'

interface Detail {
  id: number; category: string; details: Record<string, string>; desired_date: string; status: string
  quote_count: number; max_quotes: number; balance: number; is_partner?: boolean
  my_quote_id: number | null; my_quote_status: string | null; my_price: number | null; my_message: string | null
  customer_name: string | null; customer_phone: string | null
}

const INPUT = 'w-full rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-brand'

export default function LifeProRequestPage() {
  const { id } = useParams()
  const [d, setD] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(() => {
    api.get(`/api/home-service/pro/requests/${id}`, sellerHeaders())
      .then((r) => setD(r.data?.data || null))
      .catch(() => setFailed(true))
  }, [id])
  useEffect(load, [load])

  async function send() {
    setSending(true)
    try {
      const r = await api.post(`/api/home-service/pro/requests/${id}/quote`, { price: price.replace(/\D/g, '') || null, message }, sellerHeaders())
      if (r.data?.success) { toast.success('견적을 보냈어요. 손님이 고르면 알림톡으로 알려 드려요'); load() }
      else toast.error(r.data?.error || '견적을 보내지 못했어요')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '견적을 보내지 못했어요')
    } finally { setSending(false) }
  }

  if (failed) return <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-[13px] text-tone-bad">요청을 찾을 수 없어요.</div>
  if (!d) return <BrandLoader fullScreen label="요청을 불러오는 중" />

  const full = d.quote_count >= d.max_quotes
  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="생활 요청 - 유어딜" description="요청 상세" url={`/life/pro/requests/${d.id}`} />
      <LifeHeader title={`${categoryLabel(d.category)} 요청`} back="/life/pro" />
      <div className="ur-content-narrow space-y-4 px-4 pb-10">
        <section className="rounded-2xl bg-surface p-5 shadow-lift">
          <div className="flex items-center justify-between text-[13px]">
            <b className="text-brand-text">{STATUS_LABEL[d.status] || d.status}</b>
            <span className="text-gray-500 dark:text-gray-400">견적 {d.quote_count} / {d.max_quotes}</span>
          </div>
          <DetailRows category={d.category} details={d.details} />
        </section>

        {d.my_quote_id ? (
          <section className="rounded-2xl bg-surface p-5 shadow-lift">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">보낸 견적</p>
            <p className="mt-1 text-[17px] font-bold">{quotePriceText(d.my_price)}</p>
            <p className="mt-2 whitespace-pre-wrap text-[13px]">{d.my_message}</p>
            {d.customer_phone ? (
              <div className="mt-4 rounded-xl bg-warm p-4">
                <p className="text-[13px]">손님이 사장님을 골랐어요</p>
                <p className="mt-1 text-[17px] font-bold">{d.customer_name || '손님'}</p>
                <a href={`tel:${d.customer_phone}`} className="ur-btn ur-btn-lg ur-btn-primary mt-3 flex w-full justify-center">{d.customer_phone} 전화하기</a>
              </div>
            ) : d.my_quote_status === 'refunded' ? (
              <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">이 요청의 참여권은 돌려드렸어요.</p>
            ) : null}
          </section>
        ) : d.status !== 'open' || full ? (
          <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">이미 마감된 요청이에요.</p>
        ) : (
          <section className="space-y-4 rounded-2xl bg-surface p-5 shadow-lift">
            <div>
              <p className="mb-2 text-[15px] font-bold">예상 금액 <span className="text-[12px] font-normal text-gray-500 dark:text-gray-400">(선택 · 비우면 방문 후 견적)</span></p>
              <input className={INPUT} inputMode="numeric" placeholder="예) 450000" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-bold">손님에게 한마디</p>
              <textarea className={`${INPUT} min-h-[96px]`} maxLength={500} placeholder="경력, 포함 내용, 방문 가능한 날 등" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <button type="button" disabled={sending || (!d.is_partner && d.balance < 1)} onClick={send} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
              {sending ? '보내는 중'
                : d.is_partner ? '제휴 업체 견적 보내기 (참여권 없이)'
                : d.balance < 1 ? '참여권이 없어요' : `참여권 1장으로 견적 보내기 (남은 ${d.balance}장)`}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
