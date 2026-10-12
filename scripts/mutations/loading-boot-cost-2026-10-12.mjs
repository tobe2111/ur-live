/**
 * ⏱️ 부팅 비용 (2026-10-12 대표 "유어쇼츠가 늦게 … 각 페이지도 … 빠른게 좋은거지") — 주입 매니페스트.
 * 가드: src/tests/unit/loading-boot-cost-2026-10-12.test.ts
 *
 * 아래 넷은 **되돌려도 에러가 안 나고 화면도 안 깨진다** — 느려질 뿐이라 재 본 사람만 안다.
 */
const T = 'src/tests/unit/loading-boot-cost-2026-10-12.test.ts'

export default [
  {
    name: '⏱️부팅 유어쇼츠 썸네일이 다시 워커 프록시로 (원본 30KB × 10장)',
    file: 'src/utils/cf-image.ts',
    find: "'cloudfront.net', 'img.youtube.com', 'i.ytimg.com']",
    replace: "'cloudfront.net']",
    test: T,
    why: '워커 프록시는 리사이즈를 못 한다(2026-06-11 실측) — 125px 카드에 hqdefault 원본이 간다.',
  },
  {
    name: '⏱️부팅 i.ytimg.com 만 빠진다 (유튜브의 다른 썸네일 호스트가 원본으로 샌다)',
    file: 'src/utils/cf-image.ts',
    find: "  'i.ytimg.com',   // 유튜브가 같은 썸네일을",
    replace: "  // 'i.ytimg.com',   // 유튜브가 같은 썸네일을",
    test: T,
    why: '한쪽만 등재하면 같은 영상의 썸네일이 주소에 따라 리사이즈되거나 안 되거나 한다.',
  },
  {
    name: '⏱️부팅 사이드 배너 엣지 캐시가 사라진다 (페이지마다 콜드 D1 388ms + DDL)',
    file: 'src/worker/index.ts',
    find: "app.get('/api/side-banners', edgeCache(600), async (c) => {",
    replace: "app.get('/api/side-banners', async (c) => {",
    test: T,
    why: '요청마다 CREATE TABLE IF NOT EXISTS + SELECT 가 돈다. 소비자 전 페이지가 이 주소를 연다.',
  },
  {
    name: '⏱️부팅 유어쇼츠 예열이 빠진다 (콜드 콜로 478ms 를 사람이 그대로 기다린다)',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: "  '/api/urshorts',\n",
    replace: '',
    test: T,
    why: '레일은 React 마운트 뒤에야 부르므로 그 왕복이 통째로 대기 시간이다.',
  },
  {
    name: '⏱️부팅 센트리가 다시 idle 단독으로 (콘텐츠보다 먼저 뜬다)',
    file: 'src/main.tsx',
    find: "    window.addEventListener('load', afterPaint, { once: true })\n",
    replace: '    afterPaint()\n',
    test: T,
    why: 'requestIdleCallback 은 "한가한 순간" 이라 부팅 중 네트워크 대기에 바로 떠서 페이지 데이터보다 앞선다.',
  },
  {
    name: '⏱️부팅 센트리 백스톱이 사라진다 (load 가 안 오면 영영 안 켜진다)',
    file: 'src/main.tsx',
    find: '    setTimeout(startSentry, 12000)',
    replace: '    void startSentry',
    test: T,
    why: '장기 연결·숨은 탭에서 load 가 안 올 수 있다 — 그때 에러 보고가 통째로 사라진다.',
  },
  {
    name: '⏱️부팅 이른 에러 수집이 사라진다 (센트리를 미루는 전제가 무너진다)',
    file: 'src/main.tsx',
    find: 'installErrorTelemetry()\n',
    replace: '',
    test: T,
    why: '센트리를 load 뒤로 미루는 것은 이 함수가 그 창을 메우기 때문에 안전하다.',
  },
]
