/**
 * 🌆 2026-11-02 홈 맨 위 지역 사진 서버 첫 화면 — 시험: src/tests/unit/home-hero-ssr-2026-11-02.test.ts
 */
const T = 'src/tests/unit/home-hero-ssr-2026-11-02.test.ts'
export default [
  {
    name: '🌆 서버 첫 화면이 다시 사진 없는 머리를 그린다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '    chromeHtml(regionHeroFromCookieHeader(cookieHeader)) +',
    replace: '    chromeHtml(null) +',
    test: T,
    why: '실사용 p75: 화면 도착 → 사진 요청 출발 1.56초.',
  },
  {
    name: '🌆 화면이 서버 사진을 페이드부터 다시 한다(한 번 꺼졌다 켜짐)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: 'try { return !!document.querySelector(`img[data-home-hero="${CSS.escape(src)}"]`) } catch { return false }',
    replace: 'return false',
    test: T,
    why: '서버가 그린 사진을 React 가 opacity 0 으로 다시 그리면 깜빡인다.',
  },
  {
    name: '🌆 쿠키를 안 남겨 다시 오는 손님도 늘 서울 사진',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '    try { document.cookie = `${HOME_HERO_COOKIE}=${homeHeroCookieValue(hero)}; Path=/; Max-Age=31536000; SameSite=Lax` } catch { /* 쿠키 막힘 — 서버는 전국 사진 */ }',
    replace: '    void 0',
    test: T,
    why: '다른 지역 손님에게 서울 사진이 먼저 떴다가 바뀐다.',
  },
]
