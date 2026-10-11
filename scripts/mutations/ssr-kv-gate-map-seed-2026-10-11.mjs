/**
 * 🚀 로딩 두 건 (2026-10-11 [UNLOCK_LOADING]) — 주입 매니페스트.
 * 가드: src/tests/unit/ssr-kv-gate-and-map-seed-2026-10-11.test.ts
 *
 * 둘 다 **에러가 안 나는 결함**이다 — KV 를 헛물어도, 지도가 시드를 못 써도 결과는 같고 느릴 뿐이다.
 */
const TEST = 'src/tests/unit/ssr-kv-gate-and-map-seed-2026-10-11.test.ts'
const PAYLOAD = 'src/worker/utils/ssr-payload.ts'
const SEED = 'src/shared/map-feed-seed.ts'
const HOOK = 'src/hooks/queries/useMapProducts.ts'
const WORKER = 'src/worker/index.ts'
const PREWARM = 'src/worker/cron/cache-prewarm.ts'
const MAP = 'src/pages/RestaurantMapPage.tsx'

export default [
  {
    name: '[KV게이트] 모든 슬롯이 다시 KV 를 묻는다 (상세·유어샵 ~100ms 헛대기)',
    file: PAYLOAD,
    find: '  if (!payload && env.CACHE_KV && isKvWarmedPath(target.path)) {',
    replace: '  if (!payload && env.CACHE_KV) {',
    test: TEST,
    why: '라이브 실측 DETAIL:self-fetch-hit 에 kv;dur=95~104ms — 아무도 안 쓰는 키를 매번 물었다.',
  },
  {
    name: '[KV게이트] 워밍 판정이 늘 거짓 — 홈도 KV 를 못 쓴다 (콜드 콜로 0-RTT 회귀)',
    file: PAYLOAD,
    find: '  return KV_WARMED.has(path);',
    replace: '  return KV_WARMED.has(path) && false;',
    test: TEST,
    why: '게이트를 조이다 쓰는 키까지 막으면 콜드 콜로 홈 TTFB 가 self-fetch 로 돌아간다.',
  },
  {
    name: '[지도시드] 화면 첫 요청이 시드 경로와 어긋난다 (미리 데운 것을 못 쓴다)',
    file: SEED,
    find: '  if (sort) params.sort = sort\n',
    replace: '  if (sort) params.order = sort\n',
    test: TEST,
    why: '캐시 키가 곧 경로다 — 글자 하나만 달라도 예열·KV·시드가 전부 헛돈다.',
  },
  {
    name: '[지도시드] 위치 있는 사람(거리순)에게도 할인순 시드를 보여 준다 (거짓 목록)',
    file: SEED,
    find: "  return category === 'all' && !near && sort === MAP_SEED_SORT",
    replace: "  return category === 'all' && sort === MAP_SEED_SORT",
    test: TEST,
    why: '다른 요청의 답을 첫 화면에 쓰면 정렬이 틀린 목록이 뜬다.',
  },
  {
    name: '[지도시드] 훅이 지도 시드를 안 읽는다 (첫 화면이 다시 요청을 기다린다)',
    file: HOOK,
    find: "return readSeed('__SSR_INITIAL_MAP__')",
    replace: 'return null',
    test: TEST,
    why: '워커가 실어 준 시드를 버리면 하드로드마다 한 왕복을 더 기다린다.',
  },
  {
    name: '[지도시드] 워커가 /map 시드를 안 싣는다',
    file: WORKER,
    find: "      ssrTarget = { slot: 'MAP', path: MAP_SEED_PATH };",
    replace: '      ssrTarget = null;',
    test: TEST,
    why: '슬롯이 없으면 __SSR_INITIAL_MAP__ 이 안 온다.',
  },
  {
    name: '[지도시드] 지도 청크가 병렬 preload 를 못 받는다',
    file: WORKER,
    find: "      : url.pathname === '/map' ? 'map'\n",
    replace: '',
    test: TEST,
    why: '지도 페이지 청크가 엔트리 실행 뒤에야 발견돼 직렬로 내려온다.',
  },
  {
    name: '[지도시드] cron 이 지도 시드를 전역 KV 에 안 쓴다',
    file: PREWARM,
    find: "  '/api/group-buy/products?category=all&sort=discount',            // MAP(지도)\n",
    replace: '',
    test: TEST,
    why: '콜드 콜로에서 지도 시드가 self-fetch 로 떨어진다.',
  },
  {
    name: '[지도시드] 지도 기본 정렬이 시드 정렬과 갈린다',
    file: MAP,
    find: "(userLoc ? 'distance' : MAP_SEED_SORT)",
    replace: "(userLoc ? 'distance' : 'price')",
    test: TEST,
    why: '기본 정렬을 바꾸면 시드가 영영 안 맞는다 — 에러 없이.',
  },
]
