// 🏁 2026-08-27 (대표 신고 — "유어샵 이용권 UI 가 예전 디자인으로 되어 있다"):
//   유어샵 이용권 카드를 **홈과 같은 카드**(`GroupBuyFeedCard`)로. 2026-08-19 에 카드를 한 벌로
//   합칠 때 홈·섹션만 갈아 끼우고 **유어샵이 빠져** 두 세대가 공존하고 있었다 —
//   홈은 그루폰식(머천트→제목→주소·거리→★평점→정가취소선·판매가·할인 pill, 사진 좌우 넘기기),
//   유어샵은 7월에 통일했던 그라데이션 카드.
//
// 🧭 목적지도 함께 고쳤다: 종전 `to={/products/:id}` 는 **쇼핑 상세**라 이용권이 거기 도착한 뒤
//   `canonicalDetailPath` 가 `/group-buy/:id` 로 되돌린다. 결과는 맞지만 **페이지 한 장을 헛로드**한다.
//   이제 카드가 SSOT 로 바로 간다(`to` 를 안 넘기면 `canonicalDetailPath` 가 목적지를 정한다).
//   ⚠️ 여기서는 `to` 를 **주면 안 된다** — 이 그리드는 매장 자기 이용권이라 귀속이 없다.
//      담은 핀(`CuratorPinsSection`·`CuratorPage`)만 `/u/{handle}/p/{id}` 를 넘긴다.
//
// 🧹 2026-07-20 (유어샵 전수조사): 도달불가 빈-상태 분기 제거(호출부가 gridVouchers.length>0 일 때만 렌더).
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import type { Product } from './types'

interface Props {
  mealVouchers: Product[]
}

/** 셀러 공개페이지 이용권 섹션 — 홈과 동일한 표준 카드 그리드. */
export default function VouchersTab({ mealVouchers }: Props) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
      {mealVouchers.map(p => (
        // `p` 를 통째로 넘긴다 — 서버가 3장으로 자른 `images` 가 그대로 실려 캐러셀이 산다.
        <GroupBuyFeedCard key={p.id} p={p} aboveFold={false} />
      ))}
    </div>
  )
}
