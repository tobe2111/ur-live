/** 👤 2026-11-03 로그인 읽기 사본 — 시험: src/tests/unit/d1-user-read-2026-11-03.test.ts */
const T = 'src/tests/unit/d1-user-read-2026-11-03.test.ts'
export default [
  {
    name: '👤 방금 쓴 브라우저도 사본으로(쿠키 무시 — 방금 바꾼 게 안 보인다)',
    file: 'src/worker/utils/d1-read-replica.ts',
    find: "  return hasRecentWrite(cookieHeader) ? db : publicReadDb(db)",
    replace: "  return publicReadDb(db) // MUT-ignore-fresh",
    test: T,
    why: '쓰기 직후 옛 값을 보면 손님이 "저장이 안 됐다" 고 다시 누른다.',
  },
  {
    name: '👤 쓰기 표시 미들웨어 뗌',
    file: 'src/worker/index.ts',
    find: "app.use('/api/*', recentWriteMarker() as never);",
    replace: "// MUT-no-marker",
    test: T,
    why: '표시가 없으면 사본 읽기가 늘 옛 값 위험을 진다.',
  },
  {
    name: '👤 쿠폰 받기(GET 쓰기)가 표시를 안 붙임',
    file: 'src/features/coupons/api/coupons.routes.ts',
    find: "  c.header('Set-Cookie', recentWriteCookie(), { append: true })",
    replace: "  // MUT-claim-no-cookie",
    test: T,
    why: '미들웨어는 GET 을 안 본다 — 받은 쿠폰이 쿠폰함에 늦게 뜬다.',
  },
  {
    name: '👤 딜 잔액(돈 화면)이 사본을 씀',
    file: 'src/features/points/api/points.routes.ts',
    find: '    const p = await pendingP;',
    replace: '    const p = await pendingP; void userReadDb;',
    test: T,
    why: '돈 화면은 원본만.',
  },
  {
    name: '👤 리뷰 레벨 표 메모가 세션 기준(요청마다 DDL)',
    file: 'src/worker/utils/review-level.ts',
    find: '  if (_ensured.has(dbKey(DB))) return',
    replace: '  if (_ensured.has(DB)) return',
    test: T,
    why: '사본 세션은 요청마다 새 객체 — 메모가 매번 빗나가 원본 DDL 왕복이 붙는다.',
  },
]
