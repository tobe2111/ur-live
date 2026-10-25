/**
 * 🎫 지갑 아래 "이런 이용권은 어때요?" — 2026-10-14 대표 확정 **안 B** 의 아래쪽.
 *
 * 왜: 이용권이 두세 장이면 지갑 아래가 텅 비었다(대표 스크린샷). 그 자리를 다음에 살 것으로 채운다.
 *
 * 🔌 새 요청을 만들지 않는다 — 홈 피드 기본 화면과 **같은 키·같은 주소**(`usePopularPasses`, cron 예열 키)라
 *   홈을 거쳐 왔으면 요청 0회다. 이미 가진 이용권(같은 상품)은 뺀다.
 */
import { Link } from 'react-router-dom'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { usePopularPasses } from '@/pages/guest/usePopularPasses'
import { HOME_CARD_IMG_WIDTH_BASE } from '@/shared/home-card-image'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'

/** 몇 장 보여 주나 — 시안 그대로 한 줄(2장). 늘리면 지갑이 추천 목록처럼 보인다. */
export const WALLET_RECO_COUNT = 2

export default function WalletRecommend({ ownedProductIds, t }: {
  ownedProductIds: Set<number | string>
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const { data } = usePopularPasses()
  const picks = (data ?? []).filter(p => !ownedProductIds.has(p.id) && !ownedProductIds.has(String(p.id))).slice(0, WALLET_RECO_COUNT)
  if (picks.length === 0) return null
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('voucher.recoTitle', { defaultValue: '이런 이용권은 어때요?' })}</h2>
        <Link to="/" className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{t('voucher.recoMore', { defaultValue: '더보기' })} ›</Link>
      </div>
      <div className={`grid grid-cols-2 ${DEAL_GRID_GAP}`}>
        {picks.map(p => <GroupBuyFeedCard key={p.id} p={p} imgWidth={HOME_CARD_IMG_WIDTH_BASE} hideWishlist />)}
      </div>
    </section>
  )
}
