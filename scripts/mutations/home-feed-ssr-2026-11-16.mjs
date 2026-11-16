/** 🧬 주입 — 폰 홈 서버 첫 화면 유어쇼츠 줄 + 목록 첫 6장. 가드: src/tests/unit/home-feed-ssr-2026-11-16.test.ts */
const T = 'src/tests/unit/home-feed-ssr-2026-11-16.test.ts'
const F = 'src/worker/utils/home-feed-first-screen.ts'
export default [
  { name: '홈목록 — 위치 쿠키가 있어도 그린다(거리순인데 인기순을 그림)', file: F, find: '  if (nearKeyFromCookieHeader(opts.cookieHeader)) return null\n', replace: '', test: T, why: '거리순 손님에게 다른 목록이 떴다 바뀐다.' },
  { name: '홈목록 — 섹션이 셋이어도 그린다', file: F, find: '  if (opts.visibleSectionCount !== 2) return null\n', replace: '', test: T, why: '셋째 섹션은 유어쇼츠 뒤에 온다 — 마운트 때 목록이 밀린다.' },
  { name: '홈목록 — 섹션 상품을 뒤로 안 미룬다', file: F, find: "(typeof p.id === 'number' && sectionIds.has(p.id) ? tail : head).push(p)", replace: 'head.push(p)', test: T, why: '화면 순서(deferSeeded)와 달라진다.' },
  { name: '홈목록 — 장수를 화면 첫 렌더보다 많이', file: F, find: 'export const HOME_FEED_FS_CARDS = 6', replace: 'export const HOME_FEED_FS_CARDS = 12', test: T, why: '앱이 6장으로 줄이며 아래가 올라온다.' },
  { name: '홈목록 — 워커가 MAIN 시드를 안 넘긴다', file: 'src/worker/index.ts', find: 'homeBannersPayload, homeShortsPayload, ssrPayload); if (homeFirst)', replace: 'homeBannersPayload, homeShortsPayload); if (homeFirst)', test: T, why: '목록이 안 그려진다(조용한 부재).' },
]
