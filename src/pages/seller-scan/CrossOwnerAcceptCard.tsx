/**
 * 🏷️ "다른 점주 이용권 받기" — 받는 지점 사장님의 동의 스위치 (2026-10-18 결재 ① "받는 점주가 켠 지점만").
 *
 * 같은 브랜드의 **다른 점주**가 판 이용권을 이 지점에서 받아 주고, 그 매출을 이 지점이 정산받는다.
 * 남이 정한 가격·구성으로 손님을 받게 되므로 이 지점 주인이 직접 고른다(운영자 좌석은 서버가 403).
 *
 * 기능이 아직 열리지 않았으면(게이트 OFF — `available=false`) **아무것도 그리지 않는다** — 켜 둬도 아무 일도
 * 안 하는 스위치를 보여 주지 않는다. 이미 켜 둔 지점은 게이트가 닫혀도 끌 수 있게 보여 준다.
 * 규칙·판정은 서버(`brand-cross-owner.ts`)가 한다 — 사용하는 순간 다시 판정된다.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface State { enabled: boolean; available: boolean }

export default function CrossOwnerAcceptCard() {
  const { t } = useTranslation()
  const [s, setS] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const token = localStorage.getItem('seller_token')
    api.get('/api/seller/cross-owner-accept', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => { if (alive && r.data?.success) setS(r.data.data as State) })
      .catch(() => { /* 주인이 아니거나 조회 실패 — 카드를 안 그린다 */ })
    return () => { alive = false }
  }, [])

  if (!s || (!s.available && !s.enabled)) return null

  async function flip() {
    if (busy || !s) return
    const next = !s.enabled
    setBusy(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.put('/api/seller/cross-owner-accept', { enabled: next }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (r.data?.success) {
        setS({ ...s, enabled: next })
        toast.success(next
          ? t('seller.crossOwner.on', { defaultValue: '다른 점주의 이용권도 받아요' })
          : t('seller.crossOwner.off', { defaultValue: '같은 주인 지점 이용권만 받아요' }))
      } else toast.error(r.data?.error || t('seller.crossOwner.fail', { defaultValue: '설정을 바꾸지 못했어요' }))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.crossOwner.fail', { defaultValue: '설정을 바꾸지 못했어요' }))
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-[var(--dash-radius,16px)] border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{t('seller.crossOwner.title', { defaultValue: '다른 점주 이용권 받기' })}</p>
          <p className="mt-0.5 text-[12px] text-gray-500">
            {t('seller.crossOwner.note', { defaultValue: '같은 브랜드의 다른 점주가 판 이용권을 이 지점에서 쓰면, 그 매출은 이 지점으로 정산돼요. 소개비가 붙은 이용권은 받지 않아요.' })}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={s.enabled} onClick={flip} disabled={busy}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.enabled ? 'bg-brand' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
