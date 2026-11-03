// 🏁 2026-08-27 (대표 신고 — "유어샵 이용권 UI 가 예전 디자인으로 되어 있다"):
//   유어샵 이용권 카드를 **홈과 같은 카드**(`GroupBuyFeedCard`)로.
//
// 📋 2026-11-03 대표 확정 **안 1**(시안 https://claude.ai/artifact/2GXzdhYgQMESkFpfeuyZkt) — 홈과 같은 **줄 카드**
//   (`row` — 폰 한 줄, md+ 는 종전 격자). 큰 '이번 주 픽' 히어로는 걷었다(할인율 두 번 · 사진 위 배지 · 홈과 다른 카드).
//
// 🧭 목적지: `to` 를 **주면 안 된다** — 이 목록은 매장 자기 이용권이라 귀속이 없다. 카드가 SSOT 로 간다.
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { DEAL_ROW } from '@/shared/deal-card-grid'
import type { Product } from './types'

interface Props {
  vouchers: Product[]
}

/** 셀러 공개페이지 이용권 섹션 — 홈 줄 목록과 같은 카드·같은 격자. */
export default function VouchersTab({ vouchers }: Props) {
  return (
    <div className={DEAL_ROW.grid}>
      {vouchers.map(p => (
        // `p` 를 통째로 넘긴다 — 서버가 3장으로 자른 `images` 가 그대로 실린다.
        <GroupBuyFeedCard key={p.id} p={p} row aboveFold={false} />
      ))}
    </div>
  )
}
