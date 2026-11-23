/**
 * 📞 "방문 전 전화 예약" 스위치 — 이용권 한 줄을 펼쳤을 때 (2026-11-23 대표 *"응 다 해줘"*)
 *
 * 숙소·헬스·뷰티처럼 일정을 잡아야 가는 이용권에 켠다. 켜면 손님 이용권에 [매장에 전화해 예약하기]가 뜨고,
 * 팔릴 때 알림이 가고, 통화로 정한 날짜를 [예약 관리]에 적어 둘 수 있다. 사용 처리·정산은 그대로(현장 QR).
 * 규칙: `worker/utils/visit-plan.ts`. 펼친 뒤에만 묻는다(`BrandWideToggle` 과 같은 이유).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function CallBookingToggle({ productId }: { productId: number }) {
  const { t } = useTranslation()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/api/seller/products/${productId}/call-booking`)
      .then((r) => { if (alive && r.data?.success) setOn(r.data.data?.enabled === true) })
      .catch(() => { /* 조회 실패면 스위치를 안 그린다 — 다른 일을 막지 않는다 */ })
    return () => { alive = false }
  }, [productId])

  if (on === null) return null

  async function flip() {
    if (busy || on === null) return
    const next = !on
    setBusy(true)
    try {
      const r = await api.put(`/api/seller/products/${productId}/call-booking`, { enabled: next })
      if (!r.data?.success) throw new Error(r.data?.error)
      setOn(next)
      toast.success(next
        ? t('seller.vouchers.callBookingOn', { defaultValue: '손님 이용권에 [매장에 전화해 예약하기]가 떠요' })
        : t('seller.vouchers.callBookingOff', { defaultValue: '예약 없이 바로 쓰는 이용권이에요' }))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.vouchers.callBookingFail', { defaultValue: '설정을 바꾸지 못했어요' }))
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-gray-900">{t('seller.vouchers.callBookingTitle', { defaultValue: '방문 전 전화 예약' })}</p>
        <p className="mt-0.5 text-[12px] text-gray-500">
          {on
            ? t('seller.vouchers.callBookingDescOn', { defaultValue: '손님이 전화로 날짜를 잡아요. 예약 손님은 [예약 관리]에서 봐요.' })
            : t('seller.vouchers.callBookingDescOff', { defaultValue: '숙소·헬스·뷰티처럼 날짜를 잡아야 하는 이용권이면 켜 주세요.' })}
        </p>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={flip}
        aria-label={t('seller.vouchers.callBookingTitle', { defaultValue: '방문 전 전화 예약' })}
        className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand' : 'bg-gray-300'}`}>
        <span className="absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(18px)' : undefined }} />
      </button>
    </div>
  )
}
