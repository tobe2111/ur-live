/**
 * 🔑 중개 등록 완료 — **사장님께 드릴 링크를 손에 쥐여 준다** (2026-10-10 대표 "1,2,5번은 해주고").
 *
 * 종전엔 승계 코드가 토스트로 한 번 떴다 사라졌다. 대행사가 그 순간을 놓치면 매장 관리 화면을 찾아
 * 들어가야 했고, 사장님은 코드가 있는 줄도 모른다. 이 패널은 코드를 **떠날 때까지** 보여 주고,
 * 사장님이 바로 열 수 있는 **링크**(`/store/find?code=`)를 함께 준다 — 사장님은 그 링크에서
 * 중개 조건을 확인·동의하고 소유권을 신청한다(`StoreOwnerClaimPage`).
 *
 * ⚠️ 복사는 클릭 안에서 `navigator.clipboard` — 거절되면 글자를 직접 고를 수 있게 둔다(코드는 늘 보인다).
 */
import { useState } from 'react'
import { toast } from '@/hooks/useToast'

export default function BrokerHandoffPanel({ code, onDone }: { code: string; onDone: () => void }) {
  const link = `${typeof window !== 'undefined' ? window.location.origin : 'https://urdeal.kr'}/store/find?code=${encodeURIComponent(code)}`
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast.success('링크를 복사했어요') }
    catch { toast.error('복사가 막혔어요 — 아래 링크를 길게 눌러 복사해 주세요') }
  }
  return (
    <div className="w-full bg-white rounded-[var(--dash-radius,16px)] shadow-lift p-5">
      <h2 className="text-[17px] font-bold text-gray-900">등록됐어요 — 사장님께 이 링크를 보내 주세요</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
        사장님이 링크를 열면 <b className="text-gray-900">정산 조건을 확인하고 동의</b>한 뒤, 사업자등록증으로 이 매장의 주인이 됩니다.
        그 전까지는 대행사님이 관리해요.
      </p>
      <div className="mt-4 rounded-xl bg-brand-tint px-4 py-3">
        <p className="text-[12px] font-bold text-gray-500">승계 코드</p>
        <p className="mt-1 text-[24px] font-extrabold tracking-wider tabular-nums text-gray-900 select-all">{code}</p>
        <p className="mt-2 text-[12px] text-gray-500 break-all select-all">{link}</p>
      </div>
      <button type="button" onClick={() => void copy()} className="ur-btn ur-btn-lg ur-btn-primary w-full mt-4">
        {copied ? '복사했어요' : '사장님께 보낼 링크 복사'}
      </button>
      <button type="button" onClick={onDone} className="w-full mt-2 py-3 text-[13px] font-bold text-gray-600">
        마이에서 매장 보기
      </button>
      <p className="mt-2 text-[12px] text-gray-400 text-center">이 코드는 매장 관리에서도 다시 볼 수 있어요.</p>
    </div>
  )
}
