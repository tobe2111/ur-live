/**
 * 🏨 숙소 큐레이션 · 비슷한 스테이 — 주입 매니페스트 (2026-09-24 등록).
 * 가드: src/tests/unit/stay-curations-2026-09-24.test.ts
 *
 * 여기서 제일 비싼 실수는 "사진을 크게" 를 **새 카드**로 푸는 것이다. 2026-09-03 에 대표가
 * *"여기 UI도 통일화 해야지"* 로 숙소 카드를 홈과 합쳤고(당시 네 번째 세대였다), 새로 만들면
 * 다섯 번째가 생긴다. 에러는 안 나고, 갈린다는 사실은 몇 주 뒤에나 드러난다.
 */
export default [
  {
    name: '큐레이션 제목이 약속한 조건을 안 거른다(10만원 아래에 20만원이 섞인다)',
    file: 'src/pages/stays/StayCurations.tsx',
    find: "items: items.filter(s => (s.price_from ?? 0) > 0 && (s.price_from as number) < 100000) }",
    replace: "items }",
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '제목이 "10만원 아래로 떠나는 하룻밤" 인데 20만원짜리가 섞이면 그건 디자인이 아니라 거짓말이다. ' +
      '같은 날 `/introduce` 에서 지어낸 수치를 걷어낸 것과 같은 규칙 — 화면이 사실이 아닌 말을 하지 않는다.',
  },
  {
    name: '두 장짜리 줄도 캐러셀로 내보낸다',
    file: 'src/pages/stays/StayCurations.tsx',
    find: 'const MIN_PER_ROW = 3',
    replace: 'const MIN_PER_ROW = 1',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '재고가 49건뿐이라 조건을 걸면 줄이 쉽게 빈다. 한두 장짜리 가로 스크롤은 캐러셀이 아니라 ' +
      '**빈 공간**이고, 대표가 지적한 "밋밋함"을 그대로 재생산한다.',
  },
  {
    name: '비슷한 스테이가 카드를 직접 그린다(다섯 번째 카드 세대)',
    file: 'src/pages/stay-detail/SimilarStays.tsx',
    find: '<StayCardRow items={items} checkIn={checkIn} checkOut={checkOut} guests={guests} />',
    replace: '<div><GroupBuyFeedCard p={items[0] as never} aboveFold={false} /></div>',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '2026-09-03 대표 지시로 숙소 카드를 홈과 통일했다(네 번째 세대를 합친 것). 여기서 다시 ' +
      '직접 그리면 폭·간격·스냅이 갈리고, 다음 카드 수정이 한쪽에만 들어간다.',
  },
  {
    name: '비슷한 스테이를 화면에 들어오기 전에 불러온다',
    file: 'src/pages/stay-detail/SimilarStays.tsx',
    find: 'if (!inView || !regionSido) return',
    replace: 'if (!regionSido) return',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '숙소 상세는 객실·달력·지도까지 이미 무거운 화면이다. 페이지 맨 아래 추천을 즉시 불러오면 ' +
      '예약 흐름과 대역폭을 다툰다 — 이용권 상세의 `OtherDealsRow` 가 같은 이유로 지연 로딩이다.',
  },
  {
    name: '비슷한 스테이가 자기 자신을 추천한다',
    file: 'src/pages/stay-detail/SimilarStays.tsx',
    find: 'rows.filter(s => s.id !== stayId)',
    replace: 'rows',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '같은 지역으로 조회하므로 **지금 보고 있는 숙소가 첫 장으로 온다.** 에러는 안 나고 그냥 ' +
      '이상해 보인다 — 리뷰에서 놓치기 가장 쉬운 종류.',
  },
  {
    name: '필터를 건 사람에게도 큐레이션을 끼워 넣는다',
    file: 'src/pages/StaysSearchPage.tsx',
    find: '{curated && <StayCurations',
    replace: '{true && <StayCurations',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '지역·타입·가격을 직접 고른 사람은 **그 결과**를 보러 온 것이다. 그 위에 다른 제안을 얹으면 ' +
      '고른 조건과 무관한 숙소가 먼저 보여 방해가 된다.',
  },
  {
    name: '이용 안내 표를 상세 페이지에 다시 인라인한다',
    file: 'src/pages/StayDetailPage.tsx',
    find: '<StayPolicyInfo policy={stay.cancellation_policy}',
    replace: '<SectionTitle>이용 안내</SectionTitle><StayPolicyInfo policy={stay.cancellation_policy}',
    test: 'src/tests/unit/stay-curations-2026-09-24.test.ts',
    why:
      '추출본과 인라인이 동시에 존재하면 제목이 두 번 나오고, 다음 수정이 한쪽에만 들어간다 ' +
      '(`SellerCard`·`UsageGuide` 와 같은 클래스).',
  },
]
