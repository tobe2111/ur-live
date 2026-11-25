/**
 * 🪪 주민등록번호 등록 시트 (2026-11-25) — 개인 소개자에게 3.3% 를 떼고 지급하면 유어딜이 매월 국세청에
 * 간이지급명세서를 내야 하고, 거기에 실명·주민등록번호가 들어간다. 서버가 암호화해 저장하고 화면엔 앞 7자리만 돌려준다.
 * API `PUT /api/influencer-settlement/tax-id` (SSOT `worker/utils/payee-tax-id.ts`).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import Sheet from '@/pages/user-profile/seller-section/Sheet'

export default function TaxIdSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (masked: string) => void }) {
  const [name, setName] = useState('')
  const [rrn, setRrn] = useState('')
  const [saving, setSaving] = useState(false)
  const digits = rrn.replace(/\D/g, '')
  const ok = name.trim().length >= 2 && digits.length === 13

  const save = async () => {
    if (!ok || saving) return
    setSaving(true)
    try {
      const r = await api.put('/api/influencer-settlement/tax-id', { legal_name: name.trim(), rrn: digits })
      if (!r.data?.success) { toast.error(r.data?.error || '저장하지 못했어요'); return }
      toast.success('저장했어요')
      onSaved(String(r.data.data?.masked || ''))
      onClose()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally { setSaving(false) }
  }

  return (
    <Sheet
      title="주민등록번호 등록"
      onClose={onClose}
      footer={
        <button type="button" onClick={save} disabled={!ok || saving}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold disabled:opacity-40 active:opacity-80">
          {saving ? '저장하는 중…' : '저장'}
        </button>
      }
    >
      <div className="space-y-5 pb-2">
        <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
          소개비에서 3.3%를 떼어 대신 신고할 때 국세청에 내는 서류(간이지급명세서)에 필요해요. 암호화해서 보관하고, 신고 외에는 쓰지 않아요.
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" aria-label="실명" autoComplete="name"
          className="w-full h-12 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none" />
        <input value={rrn} onChange={(e) => setRrn(e.target.value.replace(/[^\d-]/g, '').slice(0, 14))} inputMode="numeric" type="password"
          placeholder="주민등록번호 13자리" aria-label="주민등록번호" autoComplete="off"
          className="w-full h-12 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none" />
      </div>
    </Sheet>
  )
}
