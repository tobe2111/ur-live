/**
 * 🪦 2026-09-28 (대표 결재 — *"3번은 모두 없애줘"*) 죽은 셀러 화면 은퇴 — 주입 매니페스트.
 *
 * 지키는 것 넷: **404 안 됨 · replace · 화면 파일 없음 · API 는 그대로**.
 * 아래 결함을 심으면 `dead-seller-screens-retired-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
const TEST = 'src/tests/unit/dead-seller-screens-retired-2026-09-28.test.ts'
const ROUTES = 'src/routes/seller.routes.tsx'
const GUIDE = 'src/features/guides/api/guide-seed-seller.ts'

export default [
  {
    name: '은퇴화면 — 라우트를 통째로 지운다 (북마크가 404)',
    file: ROUTES,
    find: '      <Route path="/seller/consignment" element={<Navigate to="/seller/more" replace />} />',
    replace: '',
    test: TEST,
    why:
      '은퇴는 "없애는 것" 이 아니라 "보내는 것" 이다. 라우트까지 지우면 이미 나간 링크·북마크가 ' +
      '404 가 된다 — `/my-store` 은퇴가 라우트를 남긴 이유가 그것이다.',
  },
  {
    name: '은퇴화면 — replace 를 뺀다 (뒤로가기 무한 왕복)',
    file: ROUTES,
    find: '<Route path="/seller/youtube-growth" element={<Navigate to="/seller/more" replace />} />',
    replace: '<Route path="/seller/youtube-growth" element={<Navigate to="/seller/more" />} />',
    test: TEST,
    why:
      '`replace` 가 없으면 히스토리에 은퇴 주소가 남아, 뒤로가기가 그 주소로 되돌아오고 다시 ' +
      '리다이렉트된다 — 사용자는 뒤로가기가 안 먹는 것으로 겪는다.',
  },
  {
    name: '은퇴화면 — 성공 페이지만 살려 둔다 (반쪽 은퇴)',
    file: ROUTES,
    find: '<Route path="/seller/youtube-growth/success" element={<Navigate to="/seller/more" replace />} />',
    replace: '',
    test: TEST,
    why:
      '결제 성공 페이지가 **원래 유일한 진입점**이었다. 그것만 남기면 문을 닫은 게 아니라 ' +
      '문패만 뗀 것이 된다.',
  },
  {
    name: '은퇴화면 — 위탁 API 마운트를 함께 지운다 (머니 경로 무단 제거)',
    file: 'src/worker/index.ts',
    find: "app.route('/api/seller/consignment', consignmentRoutes);",
    replace: '',
    test: TEST,
    why:
      '⚠️ **이 주입은 방향이 반대다** — 규칙대로라면 "죽은 기능이니 API 도 지우자" 가 자연스러운데, ' +
      '위탁 정산은 **머니 경로**라 제거에 단독 세션 + staging 이 붙는다. 이번 결재는 화면만이다. ' +
      '지우려면 결재를 다시 받을 것.',
  },
  {
    name: '은퇴화면 — 가이드가 죽은 정산 주소를 다시 안내한다',
    file: GUIDE,
    find: '> 🔒 안쪽 API 는 그대로 두었습니다',
    replace: '정산은 \\`/seller/consignment/settlements\\` 에서 조회하세요.\n\n> 🔒 안쪽 API 는 그대로 두었습니다',
    test: TEST,
    why:
      '화면을 내렸는데 가이드가 계속 그 주소를 알려주면 셀러가 리다이렉트를 타고 "왜 딴 데로 가지" ' +
      '하게 된다. 가이드는 라이브 DB 로 재시드되므로 **문서 한 줄이 곧 라이브 안내문**이다.',
  },
]
