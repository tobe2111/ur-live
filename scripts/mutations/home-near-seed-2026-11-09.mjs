/** 🧬 주입 — 홈 거리순 피드 시드가 빠지면 빨간불인가. 가드: src/tests/unit/home-near-seed-2026-11-09.test.ts */
const T = 'src/tests/unit/home-near-seed-2026-11-09.test.ts'
export default [
  {
    name: '거리순시드 — 키가 달라도 시드를 쓴다',
    file: 'src/shared/home-near-seed-read.ts',
    find: "if (!el?.textContent || el.getAttribute('data-near') !== nearKey) return undefined",
    replace: 'if (!el?.textContent) return undefined',
    test: T,
    why: '다른 위치의 거리순 목록을 지금 위치의 것처럼 그린다.',
  },
  {
    name: '거리순시드 — 마감 없이 기다린다',
    file: 'src/worker/utils/home-near-seed.ts',
    find: 'return Promise.race([p.catch(() => null), late])',
    replace: 'return p.catch(() => null)',
    test: T,
    why: '차가운 위치 키의 조회가 HTML 전체를 붙잡는다.',
  },
  {
    name: '거리순시드 — 유어쇼츠 줄이 시드를 안 읽는다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: "  if (!railList) { const seeded = readHomeShortsSeed<UrShortItem>(); if (seeded) railList = { at: Date.now(), p: Promise.resolve(seeded), items: seeded } }",
    replace: '',
    test: T,
    why: '유어쇼츠 칸이 앱 부팅 + 한국→LA 왕복 뒤까지 빈 회색으로 남는다.',
  },
  {
    name: '거리순시드 — 배너 시드를 안 읽는다',
    file: 'src/components/home/useHomeBanners.ts',
    find: '    const all = readHomeBannersSeed<HomeBanner>()\n',
    replace: '    const all: HomeBanner[] | null = null\n',
    test: T,
    why: 'PC 홈 맨 위 큰 배너가 앱이 켜진 뒤 한 번 더 왕복해서야 뜬다.',
  },
]
