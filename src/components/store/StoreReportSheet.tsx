/**
 * 🚨 **매장 제보 시트** — 이용권 상세에서 "이 매장 제보하기".
 *
 * 2026-09-21 실측: 소비자 이용권 상세에 신고 입구가 **0개**였다. 그래서 남이 내 가게 이름으로
 * 이용권을 팔아도 **진짜 사장님은 알릴 곳이 없었다**(되찾기 레일은 사장님이 스스로 매장을
 * 등록하려 할 때만 만나진다).
 *
 * ## 로그인을 요구하지 않는다
 * 사장님은 대개 유어딜 계정이 없다. 계정을 요구하면 이 창구는 있으나 마나다.
 * 대신 **연락처를 필수**로 받는다 — 어드민이 되물을 수 없는 제보는 처리가 불가능하다.
 *
 * ## "내 가게인데 내가 안 올렸어요" 는 되찾기로 이어 준다
 * 제보만 받고 끝내면 사장님은 주인 자리를 되찾는 길을 모른 채 기다린다.
 * 서버가 그 사유에 `claim_path` 를 실어 보내고, 여기서 바로 이어 준다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldAlert } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Z } from '@/constants/z-index'

/** 서버 `STORE_REPORT_REASONS` 와 1:1. 한쪽만 고치면 안 된다. */
const REASONS: { value: string; label: string; hint?: string }[] = [
  { value: 'not_my_listing', label: '내 가게인데 내가 올리지 않았어요', hint: '확인 후 주인 자리를 되찾을 수 있게 도와드려요' },
  { value: 'wrong_info', label: '매장 정보가 사실과 달라요', hint: '주소·전화·영업시간 등' },
  { value: 'closed', label: '폐업했거나 영업하지 않아요' },
  { value: 'other', label: '그 밖의 문제' },
]

interface Props {
  sellerId: number
  productId?: number
  storeName?: string
  onClose: () => void
}

export default function StoreReportSheet({ sellerId, productId, storeName, onClose }: Props) {
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [detail, setDetail] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!reason) { toast.error('제보 사유를 선택해주세요'); return }
    if (contact.trim().length < 5) { toast.error('연락처(전화 또는 이메일)를 적어주세요'); return }
    setSending(true)
    try {
      const res = await api.post('/api/seller/store-reports', {
        seller_id: sellerId, product_id: productId, reason, contact: contact.trim(), detail: detail.trim(),
      })
      const data = (res.data as { success?: boolean; error?: string; data?: { claim_path?: string | null } })
      if (!data?.success) { toast.error(data?.error || '제보 접수에 실패했습니다'); return }

      toast.success('제보가 접수됐어요. 확인 후 연락드릴게요')
      const claimPath = data.data?.claim_path
      onClose()
      // 되찾기 레일로 이어 준다 — 여기서 끊으면 사장님이 다음 단계를 모른다.
      if (claimPath) navigate(claimPath)
    } catch {
      toast.error('제보 접수 중 오류가 발생했습니다')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: Z.SHEET_BODY }}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full sm:max-w-md max-h-[86dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-text" />
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">이 매장 제보하기</h2>
              {storeName && <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{storeName}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 -m-1">
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`w-full text-left rounded-lg px-3 py-3 border ${
                reason === r.value
                  ? 'border-brand bg-brand/5'
                  : 'border-rule bg-warm'
              }`}
            >
              <p className="text-[14px] font-medium text-gray-900 dark:text-white">{r.label}</p>
              {r.hint && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{r.hint}</p>}
            </button>
          ))}
        </div>

        <label className="block text-[12px] font-bold text-gray-900 dark:text-white mb-1">
          연락처 <span className="text-brand-text">*</span>
        </label>
        <input
          value={contact}
          onChange={e => setContact(e.target.value)}
          placeholder="010-0000-0000 또는 이메일"
          className="w-full px-3 py-2.5 rounded-lg border border-rule bg-warm text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-brand focus:outline-none mb-1"
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">확인을 위해 담당자가 연락드릴 수 있어요. 로그인은 필요 없어요.</p>

        <label className="block text-[12px] font-bold text-gray-900 dark:text-white mb-1">자세한 내용 (선택)</label>
        <textarea
          value={detail}
          onChange={e => setDetail(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="어떤 점이 문제인지 알려주세요"
          className="w-full px-3 py-2.5 rounded-lg border border-rule bg-warm text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-brand focus:outline-none mb-4"
        />

        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="w-full py-3 rounded-lg bg-brand text-white text-[15px] font-bold disabled:opacity-40"
        >
          {sending ? '접수 중…' : '제보하기'}
        </button>
      </div>
    </div>
  )
}
