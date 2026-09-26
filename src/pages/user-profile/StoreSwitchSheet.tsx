/**
 * 🪑 가게 전환 시트 — 마이 안에서 (2026-09-25, 설계 §14)
 *
 * 매장이 **2곳 이상일 때만** 열린다. 대부분의 사장님은 가게가 하나뿐이고, 그들에게
 * "전환할 곳이 하나뿐인 목록"은 순수한 소음이다(셀러 대시보드 `StoreSwitcher` 와 같은 판단).
 *
 * ## 여기서만 `/my-stores` 를 부른다
 * 마이 첫 로드는 `/my-stores/summary` 한 번뿐이다. 사장님 승계 코드(`owner_claim_code`)는
 * **발급 side-effect** 가 있어서 마이를 열 때마다 부를 값이 아니다 — 시트를 연 사람에게만 부른다.
 *
 * ## 전환 뒤
 * `switchSeat` 이 세대를 올리고, 구독 중인 화면들이 스스로 데이터를 버리고 다시 부른다(§15-3).
 * 그래서 여기서는 시트를 닫기만 한다 — 리로드하지 않는다(그러면 인라인이 아니다).
 */
import { useEffect, useState } from 'react'
import { Check, Loader2, Store, X } from 'lucide-react'
import { Z } from '@/constants/z-index'
import { switchSeat } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'

interface OperableStore {
  seller_id: number
  role: 'owner' | 'operator'
  business_name: string | null
  name: string | null
  status: string | null
  has_owner?: boolean
  owner_claim_code?: string | null
}

const label = (s: OperableStore) => s.business_name || s.name || `매장 #${s.seller_id}`

const STATUS_NOTE: Record<string, string> = {
  pending: '승인 대기 중',
  rejected: '반려됨',
}

export default function StoreSwitchSheet({ currentSellerId, onClose }: {
  currentSellerId: number | null
  onClose: () => void
}) {
  const [stores, setStores] = useState<OperableStore[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/my-stores'))
      .then((r) => { if (alive) { if (r.data?.success) setStores(r.data.data || []); else setFailed(true) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function pick(s: OperableStore) {
    if (busy || s.seller_id === currentSellerId) { onClose(); return }
    setBusy(s.seller_id)
    const ok = await switchSeat(s.seller_id, label(s)).catch(() => false)
    setBusy(null)
    if (!ok) { toast.error('가게를 바꾸지 못했습니다'); return }
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/45"
        style={{ zIndex: Z.SHEET_BACKDROP }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="가게 전환"
        className="fixed inset-x-0 bottom-0 max-h-[80dvh] flex flex-col rounded-t-2xl bg-surface"
        style={{ zIndex: Z.SHEET_BODY }}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-rule shrink-0">
          <span className="text-[16px] font-extrabold text-gray-900 dark:text-white">가게 전환</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 -mr-2 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          {stores === null && !failed && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          )}
          {failed && (
            <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
              목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
            </p>
          )}
          {stores?.map((s) => {
            const note = s.status ? STATUS_NOTE[s.status] : undefined
            const isCurrent = s.seller_id === currentSellerId
            return (
              <button
                key={s.seller_id}
                type="button"
                onClick={() => pick(s)}
                disabled={busy !== null}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-rule active:opacity-70 disabled:opacity-50"
              >
                <Store className="w-[18px] h-[18px] mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900 dark:text-white truncate">{label(s)}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {s.role === 'owner' ? '내 가게' : '운영 중'}
                    {note ? ` · ${note}` : ''}
                  </span>
                  {s.role === 'operator' && s.has_owner === false && s.owner_claim_code && (
                    <span className="block text-[12px] text-brand-text mt-1">
                      사장님 미연결. 이 코드를 사장님께 주세요 <span className="font-bold tabular-nums">{s.owner_claim_code}</span>
                    </span>
                  )}
                </span>
                {busy === s.seller_id
                  ? <Loader2 className="w-[18px] h-[18px] mt-0.5 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
                  : isCurrent && <Check className="w-[18px] h-[18px] mt-0.5 shrink-0 text-brand-text" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
