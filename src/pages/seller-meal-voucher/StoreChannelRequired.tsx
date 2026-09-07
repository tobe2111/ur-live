/**
 * 🏪 운영 방식(직접/중개) 선택 카드 — **채널 미지정 좌석 전용** (2026-09-07 대표 결재 Q3-3)
 *
 * 결재: `docs/decisions/2026-09-07-actor-benefit-conflicts.md` ⇒ *"미지정 매장은 등록 시 채널을 반드시
 * 고르게 폼을 바꾼다"*. 2026-09-04 이후 새 매장은 등록 문에서 이미 고른다 — 이 카드가 뜨는 것은
 * **그 전에 만들어진 매장**뿐이고, 한 번 고르면 다시 안 뜬다(서버 set-once).
 *
 * 선택지 문구는 `StoreRegisterModal` ③ 과 같은 말이다("내 가게에요" / "중개·대행사에요") — 같은 질문을
 * 두 화면이 다른 말로 하면 사장님이 다른 질문으로 읽는다. 수수료율은 여기서도 보여 주지 않는다
 * (2026-08-26 대표: 채널은 "누가 운영하는가" 라는 사실이지 요금표가 아니다).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

type Channel = 'direct' | 'brokered'

export default function StoreChannelRequired({ onDone }: { onDone: (channel: Channel) => void }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<Channel | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!picked || saving) return
    setSaving(true)
    try {
      const r = await api.post('/api/seller/fee-context/channel', { channel: picked })
      if (!r.data?.success) throw new Error(r.data?.error || 'save failed')
      toast.success(t('seller.mealVoucher.channelSaved', { defaultValue: '운영 방식을 저장했어요' }))
      onDone(picked)
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string; data?: { channel?: Channel } } } }
      // 이미 정해진 좌석(다른 탭에서 골랐거나 어드민이 지정) — 그 값으로 통과시킨다. 막을 이유가 없다.
      const already = ax?.response?.status === 409 ? ax.response?.data?.data?.channel : null
      if (already === 'direct' || already === 'brokered') { onDone(already); return }
      toast.error(ax?.response?.data?.error || t('seller.mealVoucher.channelSaveFailed', { defaultValue: '운영 방식을 저장하지 못했어요' }))
    } finally {
      setSaving(false)
    }
  }

  const opt = (key: Channel, title: string, hint: string) => (
    <button type="button" onClick={() => setPicked(key)} aria-pressed={picked === key}
      className={`p-3 rounded-xl border text-left transition ${picked === key ? 'border-brand bg-[#EAF1FE]' : 'border-gray-200 hover:bg-gray-50'}`}>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
    </button>
  )

  return (
    <div className="mb-4 rounded-xl border border-brand/30 bg-[#F4F8FF] p-3.5">
      <p className="text-sm font-bold text-gray-900">
        {t('seller.mealVoucher.channelRequiredTitle', { defaultValue: '이 매장, 누가 운영하나요?' })}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5 mb-2.5">
        {t('seller.mealVoucher.channelRequiredHint', { defaultValue: '이용권을 등록하려면 한 번만 골라주세요. 정산 방식이 여기에 따라 정해져요.' })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {opt('direct',
          t('seller.mealVoucher.channelDirect', { defaultValue: '내 가게에요' }),
          t('seller.mealVoucher.channelDirectHint', { defaultValue: '제가 사장이고, 직접 운영해요' }))}
        {opt('brokered',
          t('seller.mealVoucher.channelBrokered', { defaultValue: '중개·대행사에요' }),
          t('seller.mealVoucher.channelBrokeredHint', { defaultValue: '사장님을 대신해 등록·관리해요' }))}
      </div>
      <button type="button" onClick={save} disabled={!picked || saving}
        className="mt-2.5 w-full py-2.5 rounded-xl bg-brand text-white text-sm font-bold disabled:bg-gray-300 disabled:text-gray-500">
        {saving
          ? t('seller.mealVoucher.channelSaving', { defaultValue: '저장 중…' })
          : t('seller.mealVoucher.channelConfirm', { defaultValue: '이렇게 운영해요' })}
      </button>
    </div>
  )
}
