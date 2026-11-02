/**
 * 🎁 "이 이용권 팔기" 창 — B안 한 줄을 누르면 아래에서 올라온다 (2026-11-02 대표 확정)
 *
 * 두 갈래를 한 창에 둔다:
 *   ① **내 링크로 팔기** — 유어샵에 담고 링크를 받는다(기존 담기 SSOT `usePinAction`).
 *      받는 돈은 **매장 사장님이 그 사람에게 정해 준 수수료 %** 하나뿐이다(플랫폼 2% 어필리에이트는 2026-08-22 종료).
 *      링크로 들어온 손님이 **24시간 안에**, 마지막으로 누른 링크 기준으로 사면 그 사람 몫(`utils/affiliate-ref-store.ts`).
 *      약정이 없으면 사장님께 **수수료 요청**을 보낸다 — 사장님이 그 사람에게 맞는 % 를 정해 제안한다(매장 × 사람마다 따로).
 *   ② **체험단 지원** — 사장님이 모집을 켰을 때만. 꺼져 있으면 (?) 를 누르면 이유가 펼쳐진다.
 *
 * ⚠️ 문구가 사실과 어긋나지 않게: 수수료는 손님이 이용권을 **쓴 뒤** 확정되고(`payout-use-gate.ts`),
 *    받는 방법은 딜·현금 중 소개자가 고른다(`influencer_balances.payout_method`). 그래서 "딜로만" 이라고 쓰지 않는다.
 */
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePinAction } from '@/features/curator/hooks/usePinAction'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { FOLLOWER_WORD, PLATFORM_LABEL } from '@/shared/seeding-labels'
import type { DealPct, OfferView } from './SellThisCard'

const SeedingApplySheet = lazy(() => import('./SeedingApplySheet'))

export default function SellThisSheet({ productId, price, sellerId, deal, offer, applyOnOpen, onClose }: {
  productId: number; price?: number; sellerId: number | null; deal: DealPct; offer: OfferView | null
  applyOnOpen: boolean; onClose: () => void
}) {
  const { togglePin, isPinning } = usePinAction()
  const [applying, setApplying] = useState(applyOnOpen)
  const [why, setWhy] = useState(false)
  const [requested, setRequested] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const on = offer && offer.enabled ? offer : null
  const pct = typeof deal === 'number' && deal > 0 ? deal : null
  const handle = (() => { try { return localStorage.getItem('user_handle') } catch { return null } })()

  if (applying && on) {
    return <Suspense fallback={null}><SeedingApplySheet productId={productId} offer={on} onClose={onClose} /></Suspense>
  }

  async function copyLink() {
    if (!handle) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${handle}/p/${productId}`)
      toast.success('링크를 복사했어요')
    } catch { toast.error('복사에 실패했어요') }
  }

  async function requestDeal() {
    if (requesting || requested) return
    setRequesting(true)
    try {
      const r = await api.post(`/api/seeding/deal-request/${productId}`)
      if (r.data?.success) { setRequested(true); toast.success('사장님께 수수료 요청을 보냈어요') }
      else toast.error(r.data?.error || '요청을 보내지 못했어요')
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '요청을 보내지 못했어요')
    } finally { setRequesting(false) }
  }

  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-surface px-5 pb-8 pt-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="이 이용권 팔기">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 dark:bg-white/20 sm:hidden" aria-hidden="true" />
        <p className="text-[17px] font-bold text-gray-900 dark:text-white">이 이용권 팔기</p>

        {/* ① 내 링크로 팔기 */}
        <div className="mt-4 border-t border-rule pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-medium text-gray-900 dark:text-white">내 링크로 팔기</p>
            {pct != null && <span className="text-[13px] font-medium text-brand-text">딜 {pct}%</span>}
          </div>
          <p data-sell-terms className="mt-1 text-[13px] leading-[1.5] text-gray-500 dark:text-gray-400">
            {pct != null
              ? `내 링크로 들어온 손님이 24시간 안에 사면 결제액의 ${pct}%를 받아요. 손님이 이용권을 쓰면 확정되고, 딜로 받거나 현금으로 정산할 수 있어요.`
              : deal === null
                ? '로그인하면 내 유어샵에 담아 링크로 팔 수 있어요.'
                : '이 매장은 아직 나에게 수수료를 정하지 않았어요. 사장님께 요청하면 나에게 맞는 수수료를 제안받을 수 있어요.'}
          </p>
          <button type="button" disabled={isPinning} onClick={() => togglePin(productId, price)}
            className="ur-btn ur-btn-lg ur-btn-primary mt-3 w-full disabled:opacity-60">
            내 유어샵에 담고 링크 복사
          </button>
          {handle && (
            <button type="button" onClick={copyLink} className="mt-2 h-11 w-full text-[13px] text-gray-500 dark:text-gray-400">
              이미 담았다면 링크만 복사
            </button>
          )}
          {deal === 0 && sellerId != null && (
            <button type="button" disabled={requesting || requested} onClick={requestDeal}
              className="mt-2 h-11 w-full rounded-xl bg-wash text-[15px] font-medium text-gray-900 disabled:text-gray-500 dark:text-white">
              {requested ? '요청을 보냈어요' : '사장님께 수수료 요청'}
            </button>
          )}
        </div>

        {/* ② 체험단 지원 */}
        <div className="mt-5 border-t border-rule pt-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[15px] font-medium text-gray-900 dark:text-white">체험단 지원</p>
            {!on && offer && (
              <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} aria-label="체험단 지원 설명"
                className="flex h-11 w-11 items-center justify-center">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-400 text-[12px] font-medium text-gray-500 dark:border-gray-500 dark:text-gray-400">?</span>
              </button>
            )}
          </div>
          {on ? (
            <>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                {on.platforms.map((p) => PLATFORM_LABEL[p]).join('·')} {FOLLOWER_WORD[on.platforms[0]]} {formatNumber(on.min_followers)}명 이상 · 이번 달 남은 자리 {formatNumber(on.slots_left)}
              </p>
              <button type="button" onClick={() => setApplying(true)} className="mt-3 h-11 w-full rounded-xl bg-wash text-[15px] font-medium text-gray-900 dark:text-white">
                지원하기
              </button>
            </>
          ) : offer ? (
            why && (
              <p className="mt-1 text-[13px] leading-[1.5] text-gray-500 dark:text-gray-400">
                이 매장은 지금 체험단을 모집하지 않아요. 사장님이 모집을 열면 여기서 지원할 수 있어요.{' '}
                <Link to="/influencer/seeding" className="font-medium text-brand-text underline">다른 체험 보기</Link>
              </p>
            )
          ) : (
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">체험 정보를 확인하는 중</p>
          )}
        </div>
      </div>
    </div>
  )
}
