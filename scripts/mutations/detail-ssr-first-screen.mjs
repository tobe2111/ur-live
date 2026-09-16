/**
 * 🖼️ 서버가 그리는 이용권 상세 첫 화면 (2026-09-15, 대표 "꼭 로딩이 걸려야 해?") — 주입 매니페스트.
 * 가드: src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts
 *      src/tests/unit/boot-first-screen-2026-09-16.test.tsx (폴백이 그 첫 화면을 덮지 않는가 — 판정 후속)
 */
const TEST = 'src/tests/unit/detail-ssr-first-screen-2026-09-15.test.ts'
const BODY = 'src/worker/utils/detail-ssr-body.ts'
const LOADER = 'src/components/brand/BrandLoader.tsx'
const BOOT_TEST = 'src/tests/unit/boot-first-screen-2026-09-16.test.tsx'
const PAGE = 'src/pages/GroupBuyDetailPage.tsx'

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
    // 🔁 2026-09-16: 이 자리에 있던 `서버가 제목까지 그린다` 는 **폐기**됐다 — 제목 위 per-user 블록 둘을
    //   치우고 경계를 제목까지 밀었으므로 그건 이제 의도된 동작이다(감사 로그 2026-09-16 참조).
    //   경계는 한 칸 아래로 옮겨졌다: **가격**은 여전히 안 그린다(주소 줄의 `· N km` 가 per-user 라
    //   되감기면 가격이 밀린다). 그 새 경계를 지키는 주입으로 교체한다.
    name: '🖼️ 서버가 가격까지 그린다 (주소 줄이 되감기면 그 가격이 밀린다)',
    file: BODY,
    find: "`<h1 style=\"${DETAIL_TITLE_STYLES.h1}\">${escText(d.name || '')}</h1>` +",
    replace: "`<h1 style=\"${DETAIL_TITLE_STYLES.h1}\">${escText(d.name || '')}</h1><div>16,500원</div>` +",
    test: TEST,
    why: '제목 아래 주소 줄에 내 위치 기준 거리가 문장 안으로 들어간다 — 서버가 모르는 값이라 마운트 때 한 줄이 두 줄로 되감길 수 있고, 그러면 바로 아래 가격이 밀린다.',
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
    // 🎟️ 2026-09-16 재조준: 상세 정본이 `/pass/:id` 로 옮겨가 조건이 두 갈래가 됐다(옛 주소도 방어적으로 남김).
    //   불변식은 그대로 — **pathname 으로 가른다**. 낡은 `find` 를 남기면 이 주입이 조용히 헛돈다.
    find: "ssrSlot === 'DETAIL' && ssrPayload && (url.pathname.startsWith('/pass/') || url.pathname.startsWith('/group-buy/'))",
    replace: "ssrSlot === 'DETAIL' && ssrPayload",
    test: TEST,
    why: '`/vouchers/:id` 는 같은 DETAIL 슬롯이지만 VoucherDetailPage 라 레이아웃이 다르다 — 그리면 마운트 때 통째로 갈린다.',
  },
  // ── 2026-09-16 (대표 판정에서 나온 결함: 사진이 중간에 한 번 사라진다) ───────────────────
  {
    name: '🧷 서버 래퍼 id 가 클라 상수와 갈린다 (폴백이 조용히 아무 일도 안 한다)',
    file: BODY,
    find: '`<div id="ur-first-screen" class="gbd"',
    replace: '`<div id="ur-first-screen-v2" class="gbd"',
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
    // 2026-09-16: 이 줄에 `forceDark` 배선이 얹혔다(다크 도착 표면). 지키는 불변식은 그대로 —
    //   "라우터 폴백이 BootFirstScreenLoader 를 **실제로** 쓴다".
    find: 'const PageLoader = () => <BootFirstScreenLoader forceDark={isDarkLoaderSurface(window.location.pathname)} />',
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
  // ── 2026-09-16 경계를 제목까지 (대표 "남은 후속들 모두 진행") ───────────────────────────
  {
    name: '\u{1F3F7} \uc11c\ubc84\uac00 \uc81c\ubaa9\uc744 \uc548 \uadf8\ub9b0\ub2e4 (\ud788\uc5b4\ub85c\ub9cc \ub0a8\uc544 \uccab \ud654\uba74\uc774 \ubb34\uc5c7\uc778\uc9c0 \uc548 \ub9d0\ud55c\ub2e4)',
    file: BODY,
    find: "const title = hasRef ? '' : titleHtml(d)",
    replace: "const title = ''",
    test: TEST,
    why: '\uc81c\ubaa9\uc740 \uc2dc\ub4dc\uc5d0 \uc9c4\uc791 \ub3c4\ucc29\ud574 \uc788\ub2e4 \u2014 \uc548 \uadf8\ub9ac\uba74 1\ucd08 \ub3d9\uc548 \uc0ac\uc9c4\ub9cc \ubcf4\uc774\uace0 \ubb34\uc2a8 \uc0c1\ud488\uc778\uc9c0\ub97c \ubabb \uc77d\ub294\ub2e4.',
  },
  {
    name: '\u{1F3F7} h1 \uc2a4\ud0c0\uc77c\uc774 \ud398\uc774\uc9c0\uc640 \uac08\ub9b0\ub2e4 (\ub9c8\uc6b4\ud2b8 \ub54c \uc81c\ubaa9\uc774 \ud284\ub2e4)',
    file: BODY,
    find: "h1: 'margin:4px 0 0;font-size:21px",
    replace: "h1: 'margin:4px 0 0;font-size:20px",
    test: TEST,
    why: '\uc11c\ubc84\uc640 React \uac00 \uac19\uc740 \uc81c\ubaa9\uc744 \ub2e4\ub978 \ud06c\uae30\ub85c \uadf8\ub9ac\uba74 \uadf8 \uc790\ub9ac\uac00 \ub9c8\uc6b4\ud2b8 \uc21c\uac04 \ubc14\ub01c\ub2e4 \u2014 \ub300\ud45c\uac00 \uae08\uc9c0\ud55c "\ub85c\ub529 \ud654\uba74 2~3\uac1c" \uc758 \ubaa8\uc591.',
  },
  {
    name: '\u{1F3F7} `?ref=` \uac8c\uc774\ud2b8\uac00 \uc0ac\ub77c\uc9c4\ub2e4 (\ucd94\ucc9c \ubc30\ub108\uac00 \uc81c\ubaa9\uc744 \ubc00\uc5b4\ub0b4\ub294 \uc720\uc77c\ud55c \uacbd\uc6b0)',
    file: BODY,
    find: "const title = hasRef ? '' : titleHtml(d)",
    replace: 'const title = titleHtml(d)',
    test: TEST,
    why: '`?ref=` \uc9c4\uc785\uc740 \uc81c\ubaa9 \uc704\uc5d0 \ubc30\ub108\ub97c \ud558\ub098 \ub354 \uadf8\ub9b0\ub2e4 \u2014 URL \ub85c \uc54c \uc218 \uc788\ub294 \uacbd\uc6b0\ub77c \uc811\uc73c\uba74 \ub418\ub294\ub370, \uc548 \uc811\uc73c\uba74 \uadf8 \ub9c1\ud06c\ub85c \ub4e4\uc5b4\uc628 \uc0ac\ub78c\ub9cc \uc81c\ubaa9\uc774 \ubc00\ub9b0\ub2e4.',
  },
  {
    name: '\u{1F3F7} \uac10\uc2f8\ub294 \ub178\ub4dc\uc5d0\uc11c `.gbd` \uac00 \ube60\uc9c4\ub2e4 (\uc81c\ubaa9 \uc0c9\u00b7\ubc14\ud0d5\uc774 \ub9c8\uc6b4\ud2b8 \ub54c \ubc14\ub010\ub2e4)',
    file: BODY,
    find: '`<div id="ur-first-screen" class="gbd" style="background:var(--gbd-card);color:var(--gbd-ink)">`',
    replace: '`<div id="ur-first-screen">`',
    test: TEST,
    why: '`--gbd-*` \ub294 `.gbd` \uc548\uc5d0\uc11c\ub9cc \ud480\ub9b0\ub2e4. \ud074\ub798\uc2a4\uac00 \uc5c6\uc73c\uba74 \uc81c\ubaa9\uc774 \uae30\ubcf8\uc0c9\uc774 \ub418\uace0 \ubc14\ud0d5\ub3c4 --bg \u2192 --surface \ub85c \ubc14\ub01c\ub2e4.',
  },
  {
    name: '\u{1F3F7} \uacf5\uc720 \ubcf4\uc0c1 \ubc30\ub108\uac00 \ub2e4\uc2dc \uc81c\ubaa9 \uc704\ub85c \uc62c\ub77c\uac04\ub2e4 (\ub51c \ubcf4\uc720\uc790\ub9cc \uc81c\ubaa9\uc774 \ubc00\ub9b0\ub2e4)',
    file: PAGE,
    find: '        {/* \ud0c0\uc774\ud2c0 \u2014 \u{1F4F1} \ubaa8\ubc14\uc77c \uc804\uc6a9.',
    replace: '        <div className="px-[18px]"><ShareRewardBanner sellerId={detail.seller_id as number | null} productId={detail.id} /></div>\n        {/* \ud0c0\uc774\ud2c0 \u2014 \u{1F4F1} \ubaa8\ubc14\uc77c \uc804\uc6a9.',
    test: TEST,
    why: '\uc774 \ubc30\ub108\ub294 \uc11c\ubc84 \uc870\ud68c\uac00 \ub05d\ub098\uc57c \ub728\ub294\ub370 \uc81c\ubaa9 \uc704\uc5d0 \uc788\uc73c\uba74 \ub51c \uac00\uc9c4 \uc0ac\ub78c\uc5d0\uac8c\ub9cc \ub4a4\ub2a6\uac8c \uc81c\ubaa9\uc774 \uc544\ub798\ub85c \ubc00\ub9b0\ub2e4 \u2014 \uc11c\ubc84 \ub80c\ub354 \uc774\uc804\ubd80\ud130 \uc788\ub358 \ubc00\ub9bc\uc774\ub2e4.',
  },
  {
    name: '\u{1F3F7} \ubc30\ub108 \uce78\uc758 `empty:hidden` \uc774 \ube60\uc838 \ube48 16px \uac00 \ub0a8\ub294\ub2e4',
    file: PAGE,
    find: 'className="px-[18px] pb-4 empty:hidden"',
    replace: 'className="px-[18px] pb-4"',
    test: TEST,
    why: '\ubc30\ub108\ub294 \ub300\ubd80\ubd84\uc758 \uc0ac\ub78c\uc5d0\uac8c null \uc774\ub77c, \uc811\uc9c0 \uc54a\uc73c\uba74 \uac00\uaca9\uacfc \uc218\ub7c9 \uc0ac\uc774\uc5d0 \uc544\ubb34 \uc774\uc720 \uc5c6\ub294 \ube48\uce78\uc774 \uc0dd\uae34\ub2e4.',
  },
]
