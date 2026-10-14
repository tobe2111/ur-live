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
    name: '🎟️ 교환권 첫 화면 목록 줄의 판 클래스가 DealRow 와 갈린다',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: "row: 'w-full flex items-center gap-3 text-left px-3 py-2 rounded-2xl",
    replace: "row: 'w-full flex items-center gap-3 text-left px-3 py-3 rounded-2xl",
    test: TEST,
    why: '세로 여백이 다르면 줄마다 높이가 갈려 마운트 때 목록 전체가 움직인다.',
  },
  {
    name: '🎟️ 교환권 첫 화면 사진이 최우선순위로 돌아간다(CSS·JS 와 회선 경쟁)',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: 'fetchpriority="low"',
    replace: 'fetchpriority="${above ? \'high\' : \'auto\'}"',
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
]
