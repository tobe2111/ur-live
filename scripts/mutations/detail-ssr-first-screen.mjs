/**
 * 🖼️ 서버가 그리는 이용권 상세 첫 화면 (2026-09-15, 대표 "꼭 로딩이 걸려야 해?") — 주입 매니페스트.
 * 가드: src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts
 *      src/tests/unit/boot-first-screen-2026-09-16.test.tsx (폴백이 그 첫 화면을 덮지 않는가 — 판정 후속)
 */
const TEST = 'src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts'
const BODY = 'src/worker/utils/detail-ssr-body.ts'
const LOADER = 'src/components/brand/BrandLoader.tsx'
const BOOT_TEST = 'src/tests/unit/boot-first-screen-2026-09-16.test.tsx'

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
    find: '`<div id="ur-first-screen">${crumbHtml(d.category)}${hero}</div>` + shortLoader',
    replace: '`<div id="ur-first-screen">${crumbHtml(d.category)}${hero}<h1>${escText(d.name)}</h1></div>` + shortLoader',
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
  // ── 2026-09-16 (대표 판정에서 나온 결함: 사진이 중간에 한 번 사라진다) ───────────────────
  {
    name: '🧷 서버 래퍼 id 가 클라 상수와 갈린다 (폴백이 조용히 아무 일도 안 한다)',
    file: BODY,
    find: '`<div id="ur-first-screen">',
    replace: '`<div id="ur-first-screen-v2">',
    test: BOOT_TEST,
    why: '두 리터럴이 갈리면 에러 없이 노드를 못 찾아 종전 풀스크린 로더로 돌아간다 — 실패가 아니라 조용한 부재.',
  },
  {
    name: '🧷 폴백이 다시 풀스크린 오버레이로 사진을 덮는다',
    file: LOADER,
    find: "const node = typeof window !== 'undefined' ? takeBootFirstScreen(window.location.pathname) : null",
    replace: 'const node: HTMLElement | null = null',
    test: BOOT_TEST,
    why: '2026-09-15 판정에서 실제로 난 결함 그 자체 — `fixed inset-0` 불투명 로더가 방금 도착한 히어로를 540ms 덮었다.',
  },
  {
    name: '🧷 App 소비자 폴백이 배선에서 빠진다',
    file: 'src/App.tsx',
    find: 'const PageLoader = () => <BootFirstScreenLoader />',
    replace: 'const PageLoader = () => <BrandLoader fullScreen />',
    test: BOOT_TEST,
    why: '컴포넌트가 있어도 라우터가 안 쓰면 없는 것과 같다(이 레포가 반복해 당한 "조용한 부재").',
  },
  {
    name: '🧷 부팅 시점 캡처가 사라진다 (React 가 비운 뒤엔 잡을 게 없다)',
    file: 'src/main.tsx',
    find: '      captureBootFirstScreen()\n',
    replace: '',
    test: BOOT_TEST,
    why: 'createRoot 가 컨테이너를 비우고 나면 노드 참조를 얻을 방법이 없다 — 반드시 그 앞에서 잡아야 한다.',
  },
  {
    name: '🧷 노드를 미리 떼어낸다 (커밋 전에 한 프레임 사라질 수 있다)',
    file: 'src/lib/boot-first-screen.ts',
    find: '  bootNode = el\n',
    replace: '  el.remove()\n  bootNode = el\n',
    test: BOOT_TEST,
    why: '`root.render()` 는 즉시 커밋을 보장하지 않는다 — 떼어낸 뒤 페인트가 끼면 사진이 깜빡인다. React 의 비우기+삽입은 같은 커밋이라 안 끼어든다.',
  },
]
