/**
 * 🏪 주인 관리 시트 — 2026-10-19 대표 확정 **안 A** (*"안 A로 해주고, 숙소 및 쇼핑 상품에도 관리하기를 넣자"*).
 *
 * [관리하기] 를 누르면 셀러 목록 화면으로 보내던 것(종전 안 B)을 **이 상품 하나**의 시트로 바꾼다.
 * 주인이 상세에서 누른 것은 "내 이용권 전부" 가 아니라 "지금 보고 있는 이것" 이다.
 *
 * - 숫자 두 칸(판매 / 사용) — 서버가 **주인에게만** 준다. 모르면 '—'(0 으로 위장하지 않는다).
 * - 줄: 내용·가격 수정 · 판매(예약/주문) 현황 · 사용 현황(이용권만) · 판매 중지(빨강, 시트 안에서 한 번 더 확인).
 * - 이동은 `sellerEntryPath` — 마이의 판매 도구로 곧장 간다(대시보드 주소를 거치지 않는다).
 * - 판매 중지/다시 판매는 `POST /api/group-buy/viewer/:id/active` — 판정은 구매 차단과 같은 함수다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Z } from '@/constants/z-index'
import { toast } from '@/hooks/useToast'
import { sellerEntryPath } from '@/lib/seller-deep-link'
import { ListRow } from '@/pages/user-profile/list-grammar'
import { EditIcon, OrdersIcon, ScanIcon, AlertIcon, OkIcon } from '@/components/icons/urdeal-icons'
import { ownedViewKey, type OwnedKind, type OwnedView } from '@/pages/group-buy/useViewerIsOwner'

interface Copy { edit: string; sales: string; salesPath: (id: number) => string; editPath: (id: number) => string; usage?: string; usagePath?: string; usedLabel: string | null }

/** 종류별 문구·목적지 — 한 표에 둔다(화면마다 따로 적으면 갈린다). */
export const OWNER_SHEET_COPY: Record<OwnedKind, Copy> = {
  pass: {
    edit: '내용·가격 수정', editPath: (id) => `/seller/products/${id}/edit`,
    sales: '판매 현황', salesPath: () => '/seller/voucher-orders',
    usage: '사용 현황', usagePath: '/seller/group-buy', usedLabel: '사용',
  },
  stay: {
    edit: '객실·가격 수정', editPath: (id) => `/seller/stays/${id}`,
    sales: '예약 현황', salesPath: () => '/seller/stays/bookings', usedLabel: '이용',
  },
  product: {
    edit: '내용·가격 수정', editPath: (id) => `/seller/products/${id}/edit`,
    sales: '주문 현황', salesPath: () => '/seller/orders', usedLabel: null,
  },
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ko-KR'))

export default function OwnerManageSheet({ productId, kind, view, onClose }: {
  productId: number
  kind: OwnedKind
  view: OwnedView | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const copy = OWNER_SHEET_COPY[kind]
  const active = view?.is_active !== false
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const go = (path: string) => { onClose(); navigate(sellerEntryPath(path)) }

  const setActive = async (next: boolean) => {
    setBusy(true)
    try {
      const r = await api.post(`/api/group-buy/viewer/${productId}/active`, { active: next })
      if (!r.data?.success) throw new Error(r.data?.error)
      qc.setQueryData<OwnedView>(ownedViewKey(productId), (prev) => (prev ? { ...prev, is_active: next } : prev))
      toast.success(next ? '다시 판매해요' : '판매를 멈췄어요')
      setConfirming(false)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || (e as Error)?.message
      toast.error(msg || '바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: Z.SHEET_BODY }} role="dialog" aria-modal="true" aria-label="관리">
      <button type="button" aria-label="닫기" onClick={onClose} className="ur-sheet-veil absolute inset-0 bg-black/40" />
      <div className="ur-sheet-in relative w-full sm:max-w-md max-h-[86dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-bold text-gray-900 dark:text-white">관리</p>
          {!active && <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">판매 중지됨</span>}
        </div>

        <div className={`mt-4 grid ${copy.usedLabel ? 'grid-cols-2' : 'grid-cols-1'} gap-3`} data-testid="owner-stats">
          <div className="rounded-xl bg-warm px-4 py-3">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">판매</p>
            <p className="mt-1 text-[24px] font-bold tabular-nums text-gray-900 dark:text-white">{fmt(view?.stats?.sold)}</p>
          </div>
          {copy.usedLabel && (
            <div className="rounded-xl bg-warm px-4 py-3">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">{copy.usedLabel}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-gray-900 dark:text-white">{fmt(view?.stats?.used)}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <ListRow icon={<EditIcon className="w-[18px] h-[18px]" />} label={copy.edit} onClick={() => go(copy.editPath(productId))} />
          <ListRow icon={<OrdersIcon className="w-[18px] h-[18px]" />} label={copy.sales} onClick={() => go(copy.salesPath(productId))} />
          {copy.usage && copy.usagePath && (
            <ListRow icon={<ScanIcon className="w-[18px] h-[18px]" />} label={copy.usage} onClick={() => go(copy.usagePath!)} />
          )}
        </div>

        {/* 판매 중지는 되돌릴 수 있지만 손님 화면에서 바로 사라진다 — 시트 안에서 한 번 더 묻는다
            (뷰어 프레임은 confirm() 을 안 띄우고, 시스템 대화상자는 이 화면 문법이 아니다). */}
        {active ? (
          confirming ? (
            <div className="mt-4 rounded-xl bg-tone-bad-bg px-4 py-3" data-testid="owner-stop-confirm">
              <p className="text-[15px] font-medium text-tone-bad">손님 화면에서 바로 사라져요. 멈출까요?</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}
                  className="flex-1 h-11 rounded-xl bg-surface text-[15px] font-medium text-gray-900 dark:text-white">취소</button>
                <button type="button" onClick={() => setActive(false)} disabled={busy}
                  className="flex-1 h-11 rounded-xl bg-tone-bad text-[15px] font-bold text-white disabled:opacity-60">판매 중지</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}
              className="mt-2 flex w-full items-center gap-3 py-3 text-[15px] font-medium text-tone-bad">
              <AlertIcon className="w-[18px] h-[18px]" /> 판매 중지
            </button>
          )
        ) : (
          <button type="button" onClick={() => setActive(true)} disabled={busy}
            className="mt-4 flex w-full h-[52px] items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-white disabled:opacity-60">
            <OkIcon className="w-[18px] h-[18px]" /> 다시 판매하기
          </button>
        )}
      </div>
    </div>
  )
}
