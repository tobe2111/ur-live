/**
 * 🏷️ "같은 주인 지점에서도 사용" 스위치 — 이용권 한 줄을 펼쳤을 때 (2026-10-18 대표 *"선택하게 하는게 좋지 않아?"*)
 *
 * 펼친 뒤에만 묻는다(접힌 줄 수십 개가 매번 부르지 않게). 대부분의 매장은 브랜드가 없다 —
 * 그 경우(`NO_BRAND`)와 운영자 좌석(`NOT_OWNER`)은 **아무것도 그리지 않는다**(쓸 수 없는 스위치를 보여 주지 않는다).
 * 가맹점이 섞여 받아 줄 지점이 없으면(`NO_SAME_OWNER_BRANCH`) 그 이유만 한 줄로 알린다.
 *
 * 규칙·판정은 서버(`brand-wide-redeem.ts`)가 한다 — 여기서 켜도 사용하는 순간 다시 판정된다.
 * 정산은 켜도 바뀌지 않는다(판 지점에 그대로) — 그래서 문구에 "정산은 이 지점" 을 적는다.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface State {
  enabled: boolean
  settable: boolean
  accepting_count?: number
  code?: 'NO_BRAND' | 'NOT_OWNER' | 'NO_SAME_OWNER_BRANCH'
  reason?: string
}

export default function BrandWideToggle({ productId }: { productId: number }) {
  const { t } = useTranslation()
  const [s, setS] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/api/seller/products/${productId}/brand-wide`)
      .then((r) => { if (alive && r.data?.success) setS(r.data.data as State) })
      .catch(() => { /* 조회 실패면 스위치를 안 그린다 — 다른 일을 막지 않는다 */ })
    return () => { alive = false }
  }, [productId])

  if (!s) return null
  // 켜져 있는 이용권은 이유가 무엇이든 끌 수 있게 보여 준다(주인이 아니면 서버가 403).
  if (!s.enabled && (s.code === 'NO_BRAND' || s.code === 'NOT_OWNER')) return null

  async function flip() {
    if (busy || !s) return
    const next = !s.enabled
    setBusy(true)
    try {
      const r = await api.put(`/api/seller/products/${productId}/brand-wide`, { enabled: next })
      if (r.data?.success) {
        setS({ ...s, enabled: next })
        toast.success(next
          ? t('seller.vouchers.brandWideOn', { defaultValue: '같은 주인 지점에서도 쓸 수 있어요' })
          : t('seller.vouchers.brandWideOff', { defaultValue: '이 지점에서만 쓸 수 있어요' }))
      } else toast.error(r.data?.error || t('seller.vouchers.brandWideFail', { defaultValue: '설정을 바꾸지 못했어요' }))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.vouchers.brandWideFail', { defaultValue: '설정을 바꾸지 못했어요' }))
    } finally { setBusy(false) }
  }

  const canFlip = s.enabled || s.settable
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-gray-900">
          {s.settable
            ? t('seller.vouchers.brandWideTitle', { defaultValue: '같은 주인 지점 {{count}}곳에서도 사용', count: s.accepting_count ?? 0 })
            : t('seller.vouchers.brandWideTitleOff', { defaultValue: '다른 지점에서도 사용' })}
        </p>
        <p className="mt-0.5 text-[12px] text-gray-500">
          {s.settable || s.enabled
            ? t('seller.vouchers.brandWideNote', { defaultValue: '그 지점의 확인코드·스캔으로 사용 처리돼요. 정산은 이 지점으로 들어와요.' })
            : s.reason}
        </p>
      </div>
      {canFlip && (
        <button type="button" role="switch" aria-checked={s.enabled} onClick={flip} disabled={busy}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.enabled ? 'bg-brand' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      )}
    </div>
  )
}
