/**
 * 🪑 가게 전환 시트 — 마이 안에서 (2026-09-25, 설계 §14)
 *
 * ➕ 2026-10-06 (대표 "지금 상태에서 매장 등록 새로 마이 페이지에서 하려면 뭐 눌러야 해?"): 답이
 *   **"없다"** 였다. `내 가게 등록` 타일·알약은 사장님이 **아닐 때만** 보이고, 이 시트는 2곳 이상일 때만
 *   열렸다 — 한 번 사장님이 되면 마이에서 매장을 더할 문이 사라졌다(매장 여럿·중개사에겐 막힌 길).
 *   ⇒ 맨 아래에 **[+ 매장 추가]** 를 두고, 1곳이어도 열린다(목록 하나 + 추가 = 의미 있는 시트).
 *   종전 판단("하나뿐인 목록은 소음")은 추가 줄이 생기면서 더는 성립하지 않는다.
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
import { Check, Loader2, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { UrShopIcon } from '@/components/icons/urdeal-icons'
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
  const navigate = useNavigate()
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
          <span className="text-[17px] font-extrabold text-gray-900 dark:text-white">가게 전환</span>
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
            <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
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
                className="w-full flex items-start gap-3 px-4 py-3 text-left border-b border-rule active:opacity-70 disabled:opacity-50"
              >
                <UrShopIcon className="w-[18px] h-[18px] mt-1 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-gray-900 dark:text-white truncate">{label(s)}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-1">
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
                  ? <Loader2 className="w-[18px] h-[18px] mt-1 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
                  : isCurrent && <Check className="w-[18px] h-[18px] mt-1 shrink-0 text-brand-text" aria-hidden="true" />}
              </button>
            )
          })}
          {/* ➕ 매장 추가 — 사장님이 된 뒤에도 마이에서 새 매장을 더할 유일한 문(위 머리말 참조). */}
          <button
            type="button"
            onClick={() => { onClose(); navigate('/store/new?from=my') }}
            className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
          >
            <Plus className="w-[18px] h-[18px] shrink-0 text-brand-text" aria-hidden="true" />
            <span className="flex-1 text-[15px] font-bold text-brand-text">매장 추가</span>
          </button>
        </div>
      </div>
    </>
  )
}
