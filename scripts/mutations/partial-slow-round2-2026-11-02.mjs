/**
 * 🐢 2026-11-02 부분 로딩 2차 — 시험: src/tests/unit/partial-slow-round2-2026-11-02.test.ts
 */
const T = 'src/tests/unit/partial-slow-round2-2026-11-02.test.ts'
export default [
  {
    name: '🐢 마이 내 가게 — 소유·위임 읽기가 다시 직렬',
    file: 'src/worker/utils/seller-operators.ts',
    find: 'const [owned, granted] = await Promise.all([',
    replace: 'const [owned, granted] = await Promise.all([await 0,',
    test: T,
    why: '원본 DB 직렬 왕복 하나가 한국에서 ~0.17초.',
  },
  {
    name: '🐢 내 이용권 — 색인 DDL 메모가 빠져 매 요청 다시 보냄',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: 'if (!_voucherIdxDone.has(DB)) { _voucherIdxDone.add(DB); try {',
    replace: 'if (true) { try {',
    test: T,
    why: '종전엔 매 요청 DDL 로 원본 DB 를 한 번 더 다녀왔다.',
  },
  {
    name: '🐢 유어쇼츠 — 홈 레일이 다시 앱 전체를 새로 불러옴',
    file: 'src/components/home/UrShortsRail.tsx',
    find: 'onOpen={() => navigate(`${URSHORTS_VIEWER_PATH}?v=${it.video_id}`)}',
    replace: 'onOpen={() => { window.location.href = `${URSHORTS_VIEWER_PATH}?v=${it.video_id}` }}',
    test: T,
    why: '하드 이동은 HTML·JS·로더를 처음부터 받은 뒤에야 유튜브를 받는다.',
  },
  {
    name: '🐢 유어쇼츠 — 누르는 사이 데우기가 빠짐',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '      onPointerDown={warmShortsViewer}\n',
    replace: '',
    test: T,
    why: '뷰어 코드·유튜브 재생기를 누른 뒤에야 받기 시작한다.',
  },
  {
    name: '🐢 유어쇼츠 — 홈이 재생 화면 모듈을 직접 import(봉투가 다시 짜여 전 화면 첫 화면 무게 ↑)',
    file: 'src/pages/videos/warm-viewer.ts',
    find: "  preloadRoute('videos')",
    replace: "  void import('../VideosPage')",
    test: T,
    why: '2026-11-02 CI surface-budgets 12화면 +1.5KB — lib/route-preload 머리말의 함정.',
  },
  {
    name: '🐢 마이 PC — 좌석 조회 중 지난번 값을 안 써서 폭이 다시 튐',
    file: 'src/pages/UserProfilePage.tsx',
    find: 'sellerSeats.loading ? sellerSeats.stores.length > 0 || readReservedHeight() > 0 : sellerSeats.stores.length > 0',
    // ⚠️ 바꾼 글자가 정상 코드에 이미 있으면(예: 'sellerSeats.stores.length > 0') 잔재 검사가 "주입이 남았다" 로 오판한다.
    replace: 'sellerSeats.loading ? false : sellerSeats.stores.length > 0',
    test: 'src/tests/unit/my-pc-plan5-2026-10-11.test.ts',
    why: '실사용 CLS: div.ur-account-pane 폭 519→909 · 602→1050 (2.7~3.3초).',
  },
  {
    name: '🐢 지도 — 홈이 지도 첫 목록을 미리 안 받음(SPA 진입 시 지도 생성이 목록 한 왕복을 기다림)',
    file: 'src/pages/mobile-home/map-warmup.ts',
    find: "  void loadRoute('map').then((m) => (m as { prefetchMapSeedFirstPage?: () => Promise<void> } | undefined)?.prefetchMapSeedFirstPage?.()).catch(() => { /* 지도 화면이 평소처럼 받는다 */ })",
    replace: '',
    test: T,
    why: '2026-11-02 대표 "지도도 늦게 뜨네".',
  },
]
