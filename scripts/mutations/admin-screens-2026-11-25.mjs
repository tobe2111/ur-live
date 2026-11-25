/** 🖥️ 2026-11-25 어드민 화면 전수 점검 — 가드: src/tests/unit/admin-screens-auth-2026-11-25.test.tsx */
const T = 'src/tests/unit/admin-screens-auth-2026-11-25.test.tsx'

export default [
  {
    name: '[admin-screens] 홈 섹션 관리 요청이 다시 토큰 없이 나간다',
    file: 'src/lib/api-admin-paths.ts',
    find: "  if (url.startsWith('/api/sections')) return",
    replace: "  if (url.startsWith('/api/sections_x')) return",
    test: T,
    why: '홈 섹션 관리 화면이 목록도 저장도 401 로 실패한다.',
  },
  {
    name: '[admin-screens] 공개 판정이 어드민 전용 판정보다 먼저 온다',
    file: 'src/lib/api.ts',
    find: "    if (isAdminOnlyOutsidePatterns(url, method)) {",
    replace: "    if (false && isAdminOnlyOutsidePatterns(url, method)) {",
    test: T,
    why: '`/api/sections` · `/api/debug` 가 공개 목록에 걸려 토큰이 안 붙는다.',
  },
  {
    name: '[admin-screens] 리뷰 검수 화면이 평균 평점 칸 이름을 맞추지 않는다',
    file: 'src/pages/AdminReviewModerationPage.tsx',
    find: "{ ...r.data, average_rating: Number(r.data.average_rating ?? r.data.avg_rating ?? 0) || 0 }",
    replace: "r.data",
    test: T,
    why: '서버가 주는 avg_rating 을 못 읽어 화면 전체가 오류 화면이 된다.',
  },
  {
    name: '[admin-screens] 보안 헤더가 blob 프레임을 막는다',
    file: 'src/worker/index.ts',
    find: `"frame-src 'self' blob: " +`,
    replace: `"frame-src 'self' " +`,
    test: T,
    why: '어드민 대외 소개서 미리보기가 빈 화면이 된다.',
  },
]
