/**
 * 🎁 이용권 상세 — "이 이용권 팔기" 한 줄 (2026-11-02 대표 확정 **B안**)
 *
 * 대표: *"B가 좋을 것 같은데? 그리고 그 적립이란게 처음에 가게 사장님이 인플루언서에게 산정해준 수수료 퍼센트
 * 아니야? 딜 적립이라고 표현해야 할 것 같고, 24시간 유효하다고 해야할 것 같은데? … 통합"*
 *
 * ## 무엇이 바뀌었나
 * - 종전(2026-10-31): 제목 + 설명 두 줄 + 큰 버튼 둘(담기 · 무료 체험 신청) + 안내 한 줄. 그리고 **그와 별도로**
 *   딜 보유자에게만 '내 링크로 팔리면 N% 적립돼요' 파란 배너(`ShareRewardBanner`)가 따로 떴다 — 같은 이야기를 두 곳에서 했다.
 * - 지금: **한 줄**[이 이용권 팔기 · 딜 N% ›]. 누르면 아래에서 창(`SellThisSheet`)이 올라와 '내 링크로 팔기' 와
 *   '체험단 지원' 을 고른다. 배너는 없어지고 그 % 가 이 줄의 오른쪽 값이 됐다(통합).
 *
 * ## 오른쪽 값 — 셋 중 하나
 * - 그 매장과 **활성 약정**이 있으면 `딜 N%` — 서버가 결제 시점과 **같은 판정**(`findActiveDealPct`)으로 준다.
 * - 로그인했는데 약정이 없으면 `수수료 없음` — 창 안에서 사장님께 **수수료 요청**을 보낼 수 있다.
 * - 로그아웃이면 **아무것도 안 그린다** — 묻지도 않는다(2026-10-15: 로그아웃 상세마다 이 조회가 401 이었다).
 * ⚠️ 조회 중에는 값 자리를 `invisible` 로 **예약**한다 — 늦게 와도 줄 높이·폭이 안 변한다(아래 내용이 안 밀린다).
 *
 * 주인 본인에게는 안 보인다(자기 가게를 담거나 신청할 일이 없다 — 서버도 막는다).
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getUserIdSync } from '@/utils/auth'
import type { SeedingOffer } from '@/shared/seeding'
// 창은 누를 때만 받는다 — 상세 첫 화면 무게에 넣지 않는다(surface-budgets).
const SellThisSheet = lazy(() => import('./SellThisSheet'))

export type OfferView = (SeedingOffer & { slots_left: number }) | { enabled: false }
/** 'loading' = 아직 모름(자리만 예약) · null = 로그아웃(묻지 않음) · 0 = 약정 없음 · N = 딜 N% */
export type DealPct = number | 0 | null | 'loading'

export default function SellThisCard({ productId, price, sellerId, hideForOwner: isOwner }: {
  productId: number; price?: number; sellerId?: number | null; hideForOwner?: boolean
}) {
  const [offer, setOffer] = useState<OfferView | null>(null)
  const [deal, setDeal] = useState<DealPct>(() => (getUserIdSync() ? 'loading' : null))
  const [open, setOpen] = useState(false)
  const [applyOnOpen, setApplyOnOpen] = useState(false)

  useEffect(() => {
    if (!(productId > 0) || isOwner) return
    let alive = true
    api.get(`/api/seeding/offer/${productId}`)
      .then((r) => { if (alive && r.data?.success) setOffer(r.data.data) })
      .catch(() => { if (alive) setOffer({ enabled: false }) })
    // 플랫폼 로그인에서 돌아오면 바로 체험단 신청을 다시 연다.
    try { if (new URLSearchParams(window.location.search).get('sns')) { setApplyOnOpen(true); setOpen(true) } } catch { /* noop */ }
    return () => { alive = false }
  }, [productId, isOwner])

  useEffect(() => {
    const id = Number(sellerId)
    if (isOwner || !Number.isFinite(id) || id <= 0) return
    // 비로그인이면 묻지 않는다 — 약정은 로그인한 소개자에게만 있다(묻으면 401).
    if (!getUserIdSync()) { setDeal(null); return }
    let alive = true
    api.get(`/api/influencer-settlement/deal-for-seller/${id}`)
      .then((r) => {
        const d = r.data?.data
        if (alive) setDeal(d?.active && Number(d.commission_pct) > 0 ? Number(d.commission_pct) : 0)
      })
      .catch(() => { if (alive) setDeal(0) })
    return () => { alive = false }
  }, [sellerId, isOwner])

  if (isOwner || !(productId > 0)) return null

  return (
    <>
      <button type="button" onClick={() => { setApplyOnOpen(false); setOpen(true) }} aria-haspopup="dialog"
        className="flex h-[52px] w-full items-center gap-3 bg-transparent px-4 text-left">
        <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-900 dark:text-white">이 이용권 팔기</span>
        {deal !== null && (
          <span data-sell-value className={`shrink-0 text-[13px] ${deal === 'loading' ? 'invisible' : ''} ${typeof deal === 'number' && deal > 0 ? 'font-medium text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>
            {typeof deal === 'number' && deal > 0 ? `딜 ${deal}%` : deal === 'loading' ? '딜 00%' : '수수료 없음'}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.6} aria-hidden="true" />
      </button>
      {open && (
        <Suspense fallback={null}>
          <SellThisSheet productId={productId} price={price} sellerId={sellerId ?? null} deal={deal} offer={offer}
            applyOnOpen={applyOnOpen} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
