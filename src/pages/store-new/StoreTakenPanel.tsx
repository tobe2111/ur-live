/**
 * 🕳️ 이미 유어딜에 있는 가게(409 STORE_EXISTS) — 막다른 alert 대신 다음 행동을 준다.
 *
 * 규칙은 대시보드 모달(`StoreRegisterModal` 의 `taken` 화면)과 같다:
 *  - 소유권을 **자동으로 넘기지 않는다** — 좌석 토큰(`enterStoreSeat` → 서버 `canOperateStore`)이 성공하면
 *    원래 내 매장이었던 것이다(새 권한 0).
 *  - 누구 것인지 **단정하지 않는다** — 직접 등록했을 수도, 다른 분이 대신 등록했을 수도 있다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { enterStoreSeat } from '@/utils/enter-store'
import { toast } from '@/hooks/useToast'

interface Props {
  storeName: string
  sellerId: number | null
  onEntered: (sellerId: number) => void
  onRetry: () => void
}

export default function StoreTakenPanel({ storeName, sellerId, onEntered, onRetry }: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function tryEnter() {
    if (!sellerId || busy) return
    setBusy(true)
    const ok = await enterStoreSeat(sellerId)
    setBusy(false)
    if (ok) { toast.success('이미 등록해 두신 매장이에요 — 그 매장으로 들어갈게요'); onEntered(sellerId); return }
    toast.error('이 계정으로는 그 매장에 들어갈 수 없어요')
  }

  return (
    <div className="ur-step-fwd">
      <h1 className="text-[24px] font-bold tracking-[-0.02em] leading-snug text-gray-900 dark:text-white">이미 유어딜에 있는 가게예요</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        <b className="font-medium text-gray-900 dark:text-white">{storeName}</b> 은(는) 이미 등록돼 있어요. 직접 등록해 두셨거나, 다른 분이 대신 등록했을 수 있어요.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {sellerId && (
          <button type="button" onClick={() => void tryEnter()} disabled={busy}
            className={`ur-btn ur-btn-lg ur-btn-primary w-full${busy ? ' ur-busy-ring' : ''}`}>
            {busy ? '확인하는 중…' : '내가 등록한 매장인지 확인하기'}
          </button>
        )}
        {sellerId && (
          <button type="button" onClick={() => navigate(`/store/find?seller_id=${sellerId}`)}
            className="ur-btn ur-btn-lg ur-btn-secondary w-full">제 가게예요 · 소유권 신청하기</button>
        )}
        <button type="button" onClick={onRetry} className="h-11 text-[15px] text-ink-soft">다른 가게로 다시 찾기</button>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
        사장님이신데 들어갈 수 없다면 사업자등록증으로 소유권을 신청해 주세요. 확인 후 그 매장의 주인으로 등록해 드리고, 지금까지 쌓인 상품·주문·정산 이력은 그대로 남아요.
      </p>
    </div>
  )
}
