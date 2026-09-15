/**
 * 🖼️ 서버가 그리는 이용권 상세 첫 화면 (2026-09-15, 대표 "꼭 로딩이 걸려야 해?") — 주입 매니페스트.
 * 가드: src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts'
const BODY = 'src/worker/utils/detail-ssr-body.ts'

export default [
  {
    name: '🖼️ 서버 히어로가 화면과 다른 폭으로 간다 (같은 사진을 두 번 받는다)',
    file: BODY,
    find: 'const heroUrl = detailHeroMobileUrl(main, DETAIL_HERO_MOBILE_WIDTH)',
    replace: 'const heroUrl = detailHeroMobileUrl(main, 1200)',
    test: TEST,
    why: 'preload·서버 마크업·슬라이드가 같은 URL 이라야 재사용된다. 한 글자만 달라도 버려지고 다시 받는다(2026-09-02 에 실제로 세 벌을 받고 있었다).',
  },
  {
    name: '🖼️ 서버 히어로 프레임이 3:2 를 벗어난다 (마운트 때 사진이 튄다)',
    file: BODY,
    find: 'aspect-ratio:3/2;scroll-snap-type',
    replace: 'aspect-ratio:1/1;scroll-snap-type',
    test: TEST,
    why: '갤러리가 3:2 로 그리는데 서버가 1:1 이면 React 마운트 순간 사진 높이가 바뀐다 — 대표가 금지한 "로딩 화면 2~3개" 의 정체.',
  },
  {
    name: '🖼️ 빵부스러기 클래스가 컴포넌트와 갈린다 (한 줄이 튄다)',
    file: BODY,
    find: "lg:max-w-[1200px] lg:mx-auto pt-[64px]'",
    replace: "lg:max-w-[1200px] lg:mx-auto pt-3'",
    test: TEST,
    why: '상세 헤더가 fixed 로 사진 위에 떠 있어 64px 을 비켜 줘야 한다. 갈리면 마운트 때 크럼이 위로 점프한다.',
  },
  {
    name: '🖼️ 서버가 제목까지 그린다 (딜 보유자에게만 마운트 때 아래로 밀린다)',
    file: BODY,
    find: 'return crumbHtml(d.category) + hero + shortLoader',
    replace: 'return crumbHtml(d.category) + hero + `<h1>${escText(d.name)}</h1>` + shortLoader',
    test: TEST,
    why: '제목 위에 per-user 블록(ShareRewardBanner)이 있다. "대부분은 안 밀린다"를 기준으로 통과시키면 안 된다.',
  },
  {
    name: '🖼️ 로더가 화면 높이를 다 먹는다 (사진 아래로 빈 한 화면이 생긴다)',
    file: BODY,
    find: "const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')",
    replace: 'const shortLoader = loaderHtml',
    test: TEST,
    why: '로더가 사진 아래에 붙으므로 100dvh 그대로면 문서가 화면보다 한 배 길어지고 스크롤바가 생긴다.',
  },
  {
    name: '🖼️ 교환권 상세에도 이용권 히어로를 그린다 (없는 레이아웃을 그린다)',
    file: 'src/worker/index.ts',
    find: "ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/group-buy/')",
    replace: "ssrSlot === 'DETAIL' && ssrPayload",
    test: TEST,
    why: '`/vouchers/:id` 는 같은 DETAIL 슬롯이지만 VoucherDetailPage 라 레이아웃이 다르다 — 그리면 마운트 때 통째로 갈린다.',
  },
]
