/**
 * 🎫 홈 상단 배너를 서버 첫 화면에 (2026-10-14 — 라이브 첫 방문 CLS 0.197) — 주입 매니페스트.
 * 가드: src/tests/unit/home-strip-banner-ssr-2026-10-14.test.tsx
 */
const TEST = 'src/tests/unit/home-strip-banner-ssr-2026-10-14.test.tsx'

export default [
  {
    name: '🎫 서버 첫 화면이 상단 배너를 다시 안 그린다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '${stripBannerHtml(strip)}',
    replace: '',
    test: TEST,
    why: '배너가 마운트 뒤에 끼어들어 첫 섹션 카드 넷을 197px 민다 — 에러 0, 첫 방문마다 CLS 0.197.',
  },
  {
    name: '🎫 앱이 응답 전에 시드 배너를 안 쓴다',
    file: 'src/components/home/useHomeBanners.ts',
    find: 'placeholderData: seeded,',
    replace: '',
    test: TEST,
    why: '서버가 그린 배너가 마운트 때 사라졌다가 응답 뒤 다시 나타나며 첫 섹션을 위아래로 흔든다.',
  },
  {
    name: '🎫 서버 배너 카드의 폭 클래스가 부품과 갈린다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '${many ? STRIP_CLS.cardMany : STRIP_CLS.cardOne}',
    replace: 'w-full',
    test: TEST,
    why: '두 벌이 갈리면 마운트 때 그 자리가 튄다 — 같은 상수를 써야 갈릴 수 없다.',
  },
  {
    name: '🎫 서버 배너 사진 폭이 부품과 달라 같은 사진을 두 번 받는다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: 'cfImage(b.image_url, { width: BANNER_SLOT_SPECS.strip.requestWidth, quality: 76 })',
    replace: 'cfImage(b.image_url, { width: 800, quality: 76 })',
    test: TEST,
    why: 'URL 이 한 글자만 달라도 브라우저는 캐시를 못 쓴다 — 첫 화면 가장 큰 사진을 두 번 받는다.',
  },
  {
    name: '🎫 배너 제목이 HTML 탈출 없이 서버 마크업에 들어간다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '${escText(b.title)}',
    replace: '${b.title}',
    test: TEST,
    why: '어드민 입력이 그대로 마크업이 된다 — 홈 첫 화면에 남의 태그가 그려진다.',
  },
  {
    name: '🎫 섹션 응답이 자리 구분 없이 모든 배너를 싣는다',
    file: 'src/features/sections/api/sections.routes.ts',
    find: "listActiveBanners(DB, 'strip')",
    replace: 'listActiveBanners(DB)',
    test: TEST,
    why: '자리를 안 고른 배너·다른 자리 배너가 홈 맨 위에 뜬다(2026-08-04 옛 배너 자동 노출 사고 클래스).',
  },
  {
    name: '🎫 시드 배너 장수 상한이 사라진다',
    file: 'src/shared/home-strip-banners.ts',
    find: '.slice(0, STRIP_BANNER_MAX)',
    replace: '',
    test: TEST,
    why: '부품은 다섯 장만 그리는데 시드가 더 실으면 장수 표시(1 / N)가 서버·앱에서 갈린다.',
  },
]
