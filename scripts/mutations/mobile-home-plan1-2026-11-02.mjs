/**
 * 🏠 모바일 홈 안 1 (2026-11-02 대표 확정) — 주입 매니페스트.
 * 순서: 지역 사진 → 첫 섹션 카드(제목·더보기 없음) → 배너 → 지금 인기 이용권 → 유어쇼츠. '전국' 은 서울 그림.
 */
export default [
  {
    name: '🏠안1 모바일 첫 섹션 제목 줄이 되살아난다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '            bareFirst\n',
    replace: '',
    test: 'src/tests/unit/home-top-banner-and-near-default.test.ts',
    why: '대표 *"이런 이용권은 어떠세요? … 더보기도 없애고"* — 지역 사진 머리와 제목이 같은 말을 두 번 한다.',
  },
  {
    name: '🏠안1 유어쇼츠가 다시 첫 섹션 뒤로 간다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '            shortsAfter={1}\n',
    replace: '',
    test: 'src/tests/unit/urshorts-core.test.ts',
    why: '대표 확정 순서는 지금 인기 이용권 **다음**이 유어쇼츠다.',
  },
  {
    name: '🏠안1 서버 첫 화면이 배너를 다시 첫 섹션 위에 그린다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '`<div class="mt-3"><section class="${HOME_FS_CLASS.panel} ur-panel-flush">` +',
    replace: '`<div class="mt-3">${stripBannerHtml(strip)}<section class="${HOME_FS_CLASS.panel} ur-panel-flush">` +',
    test: 'src/tests/unit/home-strip-banner-ssr-2026-10-14.test.tsx',
    why: '서버와 화면 순서가 갈리면 마운트 순간 카드가 배너 높이만큼 튄다(CLS).',
  },
  {
    name: '🏠안1 전국이 다시 그림 없이 뜬다',
    file: 'src/shared/home-region-hero.ts',
    find: '  return NATIONAL_HERO()\n}',
    replace: '  return null\n}',
    test: 'src/tests/unit/home-region-hero-row-2026-10-31.test.tsx',
    why: '대표 *"일단 대한민국은 서울 그림으로"* — 제목 줄이 없어 그림까지 없으면 머리가 비어 보인다.',
  },
  {
    name: '🏠안1 배너 위 구분선(8px 띠)이 되살아난다',
    file: 'src/index.css',
    find: '  .ur-home-panel.ur-panel-flush { border-bottom: 0; }\n',
    replace: '',
    test: 'src/tests/unit/mobile-home-flush-band-2026-11-02.test.ts',
    why: '대표 *"배너 위에 구분선이 신경쓰여 없애줘"*.',
  },
  {
    name: '🏠안1 서버 첫 화면만 띠를 긋는다 (마운트 때 8px 튐)',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '<section class="${HOME_FS_CLASS.panel} ur-panel-flush">',
    replace: '<section class="${HOME_FS_CLASS.panel}">',
    test: 'src/tests/unit/mobile-home-flush-band-2026-11-02.test.ts',
    why: '서버와 화면의 첫 섹션 높이가 8px 갈리면 마운트 순간 아래가 튄다.',
  },
]
