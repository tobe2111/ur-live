/**
 * 🏨 숙소 탭 — **큐레이션 줄** (2026-09-24 대표 문서 ④).
 *
 * ## 무엇을 요구받았나
 * 대표가 스테이폴리오를 예시로 들며: *"최대 5만원 쿠폰으로 떠나는 남쪽여행"* 같은 **제목 + 가로 캐러셀**,
 * *"주말에 떠나는 숙소보다는 … 클릭하고 싶은 멘트로 변경"*, *"숙소 사진 크게 넣기"*.
 * 확인해 보니 `/stays` 에는 큐레이션 섹션이 **하나도 없었다** — 상단 칩 + 4열 그리드가 전부다.
 *
 * ## ⚠️ 두 지시가 부딪히는 자리 — 카드를 새로 만들지 않는다
 * 2026-09-03 대표 지시 *"여기 UI도 통일화 해야지"* 로 숙소 목록을 **홈과 같은 `GroupBuyFeedCard`** 로
 * 통일했다(그때 이유: *"같은 서비스가 화면마다 다른 카드를 쓰면 반드시 갈린다"* — 네 번째 카드 세대였다).
 * 이번 "사진 크게" 를 새 카드로 풀면 그 결정을 뒤집고 **다섯 번째 세대**를 만든다.
 * ⇒ **카드는 그대로 두고 폭만 키운다.** 캐러셀 한 장이 화면의 68%(모바일)라 4열 그리드(약 25%)보다
 * 사진이 2.7배 커진다. 카드는 계속 한 벌이다.
 *
 * ## 📏 제목은 지어내지 않는다
 * 큐레이션 카피는 데이터에서 **참인 것만** 쓴다(`10만원 아래` = `price_from < 100000`,
 * `강원` = `region_sido`). "서울에서 한 시간" 류는 거리 보장을 못 하므로 쓰지 않는다 —
 * 같은 날 `/introduce` 에서 지어낸 수치를 걷어낸 것과 같은 규칙이다.
 *
 * ## 요청 0
 * 이미 받아 둔 검색 결과를 **클라에서 가른다.** 새 API·새 쿼리가 없다(숙소 49건, 한 번에 온다).
 * 섹션에 3장이 못 차면 그 줄은 **스스로 사라진다**(두 장짜리 캐러셀은 캐러셀이 아니다).
 */
import { Link } from 'react-router-dom'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { stayRegionLabel } from '@/shared/stay-address'
import type { StaySearchItem } from '@/hooks/queries/useStaysSearch'

/** 한 줄이 캐러셀일 자격 — 이보다 적으면 그리드가 더 낫다. */
const MIN_PER_ROW = 3
/** 한 줄에 몇 장까지 — 더 넣어도 아무도 끝까지 안 민다. */
const MAX_PER_ROW = 10

export interface StayCurationRow {
  key: string
  title: string
  items: StaySearchItem[]
}

/** 참인 사실만으로 줄을 만든다. 순서 = 화면에 보일 순서. */
export function buildStayCurations(items: StaySearchItem[]): StayCurationRow[] {
  const rows: StayCurationRow[] = [
    { key: 'under-100k', title: '10만원 아래로 떠나는 하룻밤', items: items.filter(s => (s.price_from ?? 0) > 0 && (s.price_from as number) < 100000) },
    { key: 'gangwon', title: '강원, 바다와 산 사이', items: items.filter(s => s.region_sido === '강원') },
    { key: 'city', title: '도심에서 묵기 — 서울·부산', items: items.filter(s => s.region_sido === '서울' || s.region_sido === '부산') },
    { key: 'rated', title: '다녀온 사람들이 별을 많이 준 곳', items: items.filter(s => (s.review_count ?? 0) > 0 && (s.avg_rating ?? 0) >= 4.5) },
  ]
  return rows
    .map(r => ({ ...r, items: r.items.slice(0, MAX_PER_ROW) }))
    .filter(r => r.items.length >= MIN_PER_ROW)
}

/**
 * 숙소 카드 한 줄(가로 캐러셀). **여기 하나만 둔다** — 같은 캐러셀을 화면마다 새로 쓰면
 * 폭·간격·스냅이 갈린다(이 레포가 카드에서 네 번 겪은 클래스). 숙소 상세의 '이곳과 비슷한
 * 스테이'(`SimilarStays`)도 이 부품을 쓴다.
 */
export function StayCardRow({
  items, checkIn, checkOut, guests,
}: { items: StaySearchItem[]; checkIn: string; checkOut: string; guests: number }) {
  return (
    <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0">
      {items.map(s => (
        <div key={s.id} className="shrink-0 snap-start w-[68%] sm:w-[42%] lg:w-[28%] xl:w-[23%]">
          <GroupBuyFeedCard
            p={{
              id: s.id,
              name: s.name,
              price: s.price_from ?? 0,
              image_url: s.image_url || '',
              category: 'stay_voucher',
              restaurant_address: stayRegionLabel(s.region_sido, s.region_sigungu, s.address),
              avg_rating: s.avg_rating ?? undefined,
              review_count: s.review_count ?? undefined,
            } as never}
            aboveFold={false}
            /* 🔗 날짜·인원을 이어 보낸다 — 빠지면 상세가 오늘 날짜로 다시 잡아 요금이 달라진다. */
            to={`/stays/${s.id}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`}
          />
        </div>
      ))}
    </div>
  )
}

export default function StayCurations({
  items, checkIn, checkOut, guests,
}: { items: StaySearchItem[]; checkIn: string; checkOut: string; guests: number }) {
  const rows = buildStayCurations(items)
  if (rows.length === 0) return null

  return (
    <div className="space-y-8 pb-2">
      {rows.map(row => (
        <section key={row.key}>
          <h2 className="text-[17px] sm:text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-white px-1">{row.title}</h2>
          {/* 가로 스크롤 — 한 장을 크게 보여 주는 것이 목적이라 폭을 % 로 잡는다(사진이 커진다). */}
          <StayCardRow items={row.items} checkIn={checkIn} checkOut={checkOut} guests={guests} />
        </section>
      ))}
      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="text-[17px] sm:text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-white">전체 숙소</h2>
        <Link to="/map" className="text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">지도에서 보기 →</Link>
      </div>
    </div>
  )
}
