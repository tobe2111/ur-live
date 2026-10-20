/**
 * 🔗 2026-10-15 — 이용권 공유 카드 문구 SSOT 의 되돌려-검증.
 * 가드: `src/tests/unit/pass-share-card-ssot-2026-10-15.test.ts`
 */
const TEST = 'src/tests/unit/pass-share-card-ssot-2026-10-15.test.ts'

export default [
  {
    name: '🔗 공유 카드 제목이 "공구 참여하기" 로 돌아간다',
    why: '제목은 commerce 카드에도 실리는 유일한 문구다 — 폐기 개념이 전 경로에 나간다.',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '        shareTitle={passDetailTitle(detail.name, detail.restaurant_name)}',
    replace: '        shareTitle={`${detail.name} 공구 참여하기`}',
    test: TEST,
  },
  {
    name: '🔗 공유 설명이 "N명 함께 구매 중" 으로 돌아간다',
    why: '활성 359건 중 357건이 0명이고 이 상품은 모여서 사는 게 아니다.',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '        shareDescription={passDetailDescription(detail)}',
    replace: '        shareDescription={`${detail.restaurant_name} · ${detail.group_buy_current}명 함께 구매 중`}',
    test: TEST,
  },
  {
    name: '🔗 PC 탭바 카카오 버튼만 사본으로 돌아간다',
    why: '한 링크가 공유한 자리에 따라 다른 이름으로 불린다(모바일 ↔ PC).',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '              title={passDetailTitle(detail.name, detail.restaurant_name)}',
    replace: '              title={`${detail.name} 공구 참여하기`}',
    test: TEST,
  },
  {
    name: '🔗 공유 버튼 라벨이 "나도 참여하기" 로 돌아간다',
    why: "'참여'는 2026-06-27 명칭 SSOT 가 폐기한 개념이다.",
    file: 'src/components/deal/DetailFloatingHeader.tsx',
    find: '            buttonText="구매하기"',
    replace: '            buttonText="나도 참여하기"',
    test: TEST,
  },
  {
    name: '🔗 shareTitle 폴백 제거 — 숙소 공유 제목이 undefined 가 된다',
    why: '숙소는 shareTitle 을 안 넘긴다. 폴백이 사라지면 그 카드 제목이 빈다(에러 없음).',
    file: 'src/components/deal/DetailFloatingHeader.tsx',
    find: '            title={shareTitle ?? title}',
    replace: '            title={shareTitle}',
    test: TEST,
  },
  {
    name: '🔗 보이는 머리글을 공유 제목으로 바꾼다 — 좁은 화면에서 잘린다',
    why: '머리글과 공유 제목을 가른 이유가 그것이다(가게명이 붙으면 390px 에서 잘린다).',
    file: 'src/components/deal/DetailFloatingHeader.tsx',
    find: '            {title}',
    replace: '            {shareTitle ?? title}',
    test: TEST,
  },
  {
    name: '🔴 반대 방향 — 숙소에도 shareTitle 을 넘긴다',
    why: '숙소는 자기 제목 SSOT(stayDetailTitle)가 따로 있다. 이용권 제목 규칙을 끌어오면 갈린다.',
    file: 'src/pages/StayDetailPage.tsx',
    find: '        productId={stay.id} title={stay.restaurant_name || stay.name}',
    replace: '        productId={stay.id} title={stay.restaurant_name || stay.name} shareTitle={stay.name}',
    test: TEST,
  },
  {
    name: '🔴 반대 방향 — 공유 문구를 고치면서 SSR 시드를 중성화한다',
    why: '지문 **개수**는 그대로인데 0-RTT 만 조용히 죽는다(설명은 멀쩡히 좋아 보인다).',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'useMemo<GroupBuyDetail | null>(() => pickSeedDetail<GroupBuyDetail>(',
    replace: 'useMemo<GroupBuyDetail | null>(() => false ? pickSeedDetail<GroupBuyDetail>(',
    test: TEST,
  },
  {
    name: '🔴 전제 무너짐 — commercePayload 가 description 을 받기 시작한다',
    why: '"제목이 설명보다 도달이 넓다" 는 이 수리의 근거다. 전제가 바뀌면 다시 재야 한다.',
    file: 'src/components/KakaoShareButton.tsx',
    find: 'commercePayload({ title, imageUrl, url: fullUrl, commerce, buttons })',
    replace: 'commercePayload({ title, description, imageUrl, url: fullUrl, commerce, buttons })',
    test: TEST,
  },
]
