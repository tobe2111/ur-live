/** 🧬 주입 — 유어쇼츠 목록 첫 화면이 조용히 되돌아가면 빨간불인가. 가드: src/tests/unit/urshorts-seed-2026-11-09.test.tsx */
const T = 'src/tests/unit/urshorts-seed-2026-11-09.test.tsx'
export default [
  {
    name: '🎬 워커가 /urshorts 시드를 도로 버린다',
    file: 'src/worker/index.ts',
    find: "if (url.pathname === '/urshorts' && ssrPayload && isMobileUserAgent(c.req.header('user-agent'))) for (const th of urshortsThumbPreloadHrefs(ssrPayload)) appendLcpLink(c.res.headers, th, 'auto');",
    replace: "if (url.pathname === '/urshorts') ssrPayload = null;",
    test: T,
    why: '목록이 앱이 켜진 뒤 한 왕복(한국→LA) 더 기다린다 — 2026-11-09 실측 2.2초 출발·썸네일 4초.',
  },
  {
    name: '🎬 화면이 시드를 안 읽는다(첫 렌더가 다시 로더)',
    file: 'src/pages/UrShortsBrowsePage.tsx',
    find: 'useState<UrShortItem[] | null>(() => peekShortsAll() ?? readUrShortsSeed<UrShortItem>())', // 2026-11-09 재조준: 전량 캐시(peek)가 앞에 붙었다
    replace: 'useState<UrShortItem[] | null>(() => peekShortsAll())',
    test: T,
    why: '워커가 실어 준 10편이 HTML 안에 있는데 화면이 안 쓰면 실은 의미가 없다.',
  },
  {
    name: '🎬 preload 폭이 카드와 갈린다(preload 가 버려진다)',
    file: 'src/worker/utils/urshorts-seed.ts',
    find: 'export const URSHORTS_CARD_THUMB_WIDTH = 360',
    replace: 'export const URSHORTS_CARD_THUMB_WIDTH = 320',
    test: T,
    why: '다른 폭의 주소를 미리 받으면 브라우저가 버리고 같은 사진을 다시 받는다(2026-09-02 히어로에서 실측한 클래스).',
  },
]
