/**
 * 🧾 정산 문의 시트 (2026-10-13). 종전엔 `window.prompt()` 세 번이었고, 첫 번째는 사람에게
 * **영문 코드**(`unfair_block / commission_dispute / other`)를 직접 치라고 했다. 같은 엔드포인트·같은 필드다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import Sheet from '@/pages/user-profile/seller-section/Sheet'

type DisputeType = 'commission_dispute' | 'unfair_block' | 'other'
const TYPES: { key: DisputeType; label: string }[] = [
  { key: 'commission_dispute', label: '수익 금액이 이상해요' },
  { key: 'unfair_block', label: '매장이 부당하게 막았어요' },
  { key: 'other', label: '기타' },
]
const MIN = 10

export default function DisputeSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<DisputeType>('commission_dispute')
  const [storeId, setStoreId] = useState('')
  const [desc, setDesc] = useState('')
  const [sending, setSending] = useState(false)
  const ok = desc.trim().length >= MIN

  const send = async () => {
    if (!ok || sending) return
    setSending(true)
    try {
      const sid = Number(storeId)
      await api.post('/api/influencer-settlement/disputes', {
        type,
        seller_id: type === 'unfair_block' && Number.isFinite(sid) && sid > 0 ? sid : undefined,
        description: desc.trim(),
      })
      toast.success('접수했어요. 확인 후 알림으로 알려 드릴게요')
      onClose()
    } catch {
      toast.error('접수하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally { setSending(false) }
  }

  return (
    <Sheet
      title="정산 문의"
      onClose={onClose}
      footer={
        <button type="button" onClick={send} disabled={!ok || sending}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold disabled:opacity-40 active:opacity-80">
          {sending ? '보내는 중…' : '보내기'}
        </button>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="space-y-2">
          {TYPES.map(t => (
            <button key={t.key} type="button" onClick={() => setType(t.key)}
              className={`w-full h-12 px-4 rounded-xl text-left text-[15px] font-medium ${type === t.key ? 'bg-brand-tint ring-2 ring-brand text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {type === 'unfair_block' && (
          <input value={storeId} onChange={(e) => setStoreId(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
            placeholder="매장 번호 (알면)" aria-label="매장 번호"
            className="w-full h-12 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none" />
        )}
        <div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} aria-label="내용"
            placeholder="어떤 주문·매장인지, 무엇이 이상한지 적어 주세요"
            className="w-full px-3 py-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none resize-none" />
          <p className={`text-[12px] mt-1 ${ok ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{ok ? `${desc.trim().length}자` : `${MIN}자 이상 적어 주세요`}</p>
        </div>
      </div>
    </Sheet>
  )
}
