// 🎟️ 교환권 목록 서버 첫 화면(2026-10-14) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/vouchers-first-screen-2026-10-14.test.tsx'

export default [
  {
    name: '🎟️ 교환권 첫 화면이 로그인 흔적을 안 본다(잔액 카드 높이가 달라 밀린다)',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: "if(s.getItem('user_id')||s.getItem('userId')||",
    replace: "if(",
    test: TEST,
    why: '로그인하면 잔액 자리가 한 줄 바 → 카드가 되어 서버가 그린 목록이 마운트 때 아래로 밀린다.',
  },
  {
    // 🔁 2026-10-14 재조준(대표 B안 — 3열 타일): 클래스는 이제 SSOT(`VOUCHER_TILE_CLASS`)를 두 곳이 import 해
    //   문자열이 갈릴 수 없다. 남은 갈림 자리는 **구조**다 — 워커가 브랜드 줄의 `›` 를 빠뜨리는 것.
    name: '🎟️ 교환권 첫 화면 타일의 브랜드 줄 구조가 VoucherTile 과 갈린다',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: '<span aria-hidden="true" class="${T.chev}">›</span>',
    replace: '',
    test: TEST,
    why: '브랜드 줄 모양이 다르면 마운트 때 타일 높이·글자가 바뀌어 첫 화면이 움직인다.',
  },
  {
    name: '🎟️ 교환권 모바일 목록이 다시 한 줄 행으로 — 워커 첫 화면(3열)과 갈린다',
    file: 'src/pages/VouchersPage.tsx',
    find: '<div className={VOUCHER_TILE_CLASS.grid}>\n                {displayProducts.slice(0, embedVisible)',
    replace: '<div className="grid grid-cols-1 gap-2">\n                {displayProducts.slice(0, embedVisible)',
    test: TEST,
    why: '서버는 3열 타일을 그리는데 화면이 한 줄 행을 그리면 마운트 때 목록 전체가 바뀐다.',
  },
  {
    name: '🎟️ 교환권 첫 화면 사진이 최우선순위로 돌아간다(CSS·JS 와 회선 경쟁)',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: 'fetchpriority="low" decoding="async"',
    replace: 'fetchpriority="${above ? \'high\' : \'auto\'}" decoding="async"',
    test: TEST,
    why: '재생 실측: high 면 조작 가능 시점이 0.6초 늦어진다.',
  },
  {
    name: '🎟️ 교환권 첫 화면 폴백에서 크롤러 요약이 빠진다',
    file: 'src/worker/index.ts',
    find: 'vouchersFirst || (buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml)',
    replace: 'vouchersFirst || urdealLoaderHtml',
    test: TEST,
    why: '첫 화면을 못 그리는 경우(시드 실패·PC) 크롤러 본문이 다시 8자가 된다.',
  },
  {
    name: '🎟️ 교환권 리셋 effect 가 옛 숫자로 시작 개수를 덮어쓴다(9 → 8)',
    file: 'src/pages/VouchersPage.tsx',
    find: '    setEmbedVisible(EMBED_INITIAL)\n',
    replace: '    setEmbedVisible(embedded ? 12 : 8)\n',
    test: TEST,
    why: '그 effect 는 마운트에서도 돈다 — 첫 화면이 8 장(마지막 줄 두 칸)이 된다. 2026-10-14 라이브 실측.',
  },
]
