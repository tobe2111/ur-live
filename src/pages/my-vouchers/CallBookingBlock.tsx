/**
 * 📞 전화 예약형 이용권 — 손님 블록 (2026-11-23 대표 *"응 다 해줘"* · 1단계)
 *
 * 일정을 잡아야 가는 이용권(숙소·헬스·뷰티 등)에서만 뜬다 — 그 밖의 이용권에선 아무것도 안 그린다.
 *   ① 매장에 전화해 예약하기(주 행동)  ② 통화로 정한 날짜 적어두기(선택 — 적으면 전날 알림)
 *   ③ 매장이 먼저 전화할 수 있게 내 번호 알려주기(선택 · 기본 꺼짐 · 방문 다음 날까지만 보인다)
 * 유어딜은 자리를 약속하지 않는다 — 날짜는 통화로 정한다. 규칙·저장: `worker/utils/visit-plan.ts`.
 *
 * 지갑(QR 창)과 결제 완료 화면이 같이 쓴다. 목록은 한 번만 받는다(`['visit-plans','mine']`).
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { DateInput } from '@/components/ui/date-input'
import { PhoneIcon } from '@/components/icons/phone-icon'
import { useTranslation } from '@/lib/i18n-lite'

export interface MyVisitPlan {
  code: string
  store_name: string | null
  store_phone: string | null
  visit_date: string | null
  visit_time: string | null
  share_phone: boolean
}

const KEY = ['visit-plans', 'mine'] as const
const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "11월 30일(토) 14:00" */
export function visitWhen(date: string, time: string | null): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DAYS[d.getUTCDay()]})${time ? ` ${time}` : ''}`
}

function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

export function useMyVisitPlans(enabled = true) {
  return useApiQuery<MyVisitPlan[]>(KEY, '/api/visit-plans/mine', {
    enabled,
    select: (raw) => {
      const r = raw as { success?: boolean; data?: MyVisitPlan[] }
      return r?.success && Array.isArray(r.data) ? r.data : []
    },
  })
}

export default function CallBookingBlock({ code, className = '' }: { code?: string | null; className?: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: plans } = useMyVisitPlans(!!code)
  const plan = code ? plans?.find((p) => p.code === code) : undefined
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)

  if (!plan) return null

  async function save(body: { visit_date?: string | null; visit_time?: string | null; share_phone?: boolean }, okMsg: string) {
    if (busy || !plan) return
    setBusy(true)
    try {
      const r = await api.put(`/api/visit-plans/${plan.code}`, body)
      if (!r.data?.success) throw new Error(r.data?.error)
      const d = r.data.data as { visit_date: string | null; visit_time: string | null; share_phone: boolean }
      qc.setQueryData<MyVisitPlan[]>(KEY, (prev) => (prev ?? []).map((p) => (p.code === plan.code ? { ...p, ...d } : p)))
      setEditing(false)
      toast.success(okMsg)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err?.response?.data?.error || err?.message || t('wallet.callBooking.saveFail', { defaultValue: '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요' }))
    } finally { setBusy(false) }
  }

  const startEdit = () => { setDate(plan.visit_date || ''); setTime(plan.visit_time || ''); setEditing(true) }

  return (
    <section className={`text-left ${className}`} data-call-booking>
      <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">
        {plan.visit_date
          ? t('wallet.callBooking.titleSet', { defaultValue: '방문 예약 {{when}}', when: visitWhen(plan.visit_date, plan.visit_time) })
          : t('wallet.callBooking.title', { defaultValue: '방문 전에 예약이 필요해요' })}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        {plan.visit_date
          ? t('wallet.callBooking.descSet', { defaultValue: '전날 알림을 보내 드려요. 날짜가 바뀌면 매장에 먼저 알려 주세요.' })
          : t('wallet.callBooking.desc', { defaultValue: '매장에 전화해 날짜를 정한 뒤, 가서 QR 을 보여 주세요.' })}
      </p>

      {plan.store_phone ? (
        <a href={`tel:${plan.store_phone}`} className={`ur-btn ur-btn-lg w-full mt-3 ${plan.visit_date ? 'ur-btn-secondary' : 'ur-btn-primary'}`}>
          <PhoneIcon className="w-[18px] h-[18px]" />
          {plan.visit_date
            ? t('wallet.callBooking.callAgain', { defaultValue: '매장에 전화하기' })
            : t('wallet.callBooking.call', { defaultValue: '매장에 전화해 예약하기' })}
        </a>
      ) : (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">{t('wallet.callBooking.noPhone', { defaultValue: '매장 전화번호가 등록돼 있지 않아요. 매장 정보에서 연락처를 확인해 주세요.' })}</p>
      )}

      {editing ? (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <DateInput type="date" value={date} min={todayKst()} onChange={(e) => setDate(e.target.value)} aria-label={t('wallet.callBooking.date', { defaultValue: '방문 날짜' })}
              className="h-11 w-full rounded-xl bg-gray-50 dark:bg-white/5 px-3 text-[15px] text-gray-900 dark:text-white" />
            <DateInput type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('wallet.callBooking.time', { defaultValue: '방문 시간(선택)' })}
              className="h-11 w-full rounded-xl bg-gray-50 dark:bg-white/5 px-3 text-[15px] text-gray-900 dark:text-white" />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="ur-btn ur-btn-md ur-btn-ghost dark:text-gray-300">{t('common.cancel', { defaultValue: '취소' })}</button>
            <button type="button" disabled={!date || busy}
              onClick={() => save({ visit_date: date, visit_time: time || null }, t('wallet.callBooking.saved', { defaultValue: '예약 날짜를 적어 뒀어요' }))}
              className="ur-btn ur-btn-md ur-btn-primary flex-1 disabled:opacity-40">{t('wallet.callBooking.saveDate', { defaultValue: '이 날짜로 적어두기' })}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startEdit} className="mt-3 text-[13px] font-medium text-brand-text active:opacity-60">
          {plan.visit_date
            ? t('wallet.callBooking.change', { defaultValue: '날짜 바꾸기' })
            : t('wallet.callBooking.addDate', { defaultValue: '예약한 날짜 적어두기' })}
        </button>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-900 dark:text-white">{t('wallet.callBooking.share', { defaultValue: '매장이 먼저 전화할 수 있게 내 번호 알려주기' })}</p>
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{t('wallet.callBooking.shareNote', { defaultValue: '방문 다음 날까지만 매장에 보여요.' })}</p>
        </div>
        <button type="button" role="switch" aria-checked={plan.share_phone} disabled={busy}
          aria-label={t('wallet.callBooking.share', { defaultValue: '매장이 먼저 전화할 수 있게 내 번호 알려주기' })}
          onClick={() => save({ share_phone: !plan.share_phone }, !plan.share_phone
            ? t('wallet.callBooking.shareOn', { defaultValue: '매장에 내 번호를 알려줘요' })
            : t('wallet.callBooking.shareOff', { defaultValue: '매장에 내 번호를 알리지 않아요' }))}
          className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${plan.share_phone ? 'bg-brand' : 'bg-gray-300 dark:bg-white/20'}`}>
          <span className="absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white dark:bg-white" style={{ transition: 'transform .3s cubic-bezier(.3,1.4,.5,1)', transform: plan.share_phone ? 'translateX(18px)' : undefined }} />
        </button>
      </div>
    </section>
  )
}
