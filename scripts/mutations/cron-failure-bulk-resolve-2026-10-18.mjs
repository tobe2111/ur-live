/**
 * 🧹 2026-10-18 — cron 실패 일괄 해결의 주입.
 * 가드: `src/tests/unit/cron-failure-bulk-resolve-2026-10-18.test.ts`
 * 이 도구는 "너무 많이 지우는" 쪽으로 틀리면 지금 울리는 진짜 경보가 사라진다.
 */
const U = 'src/worker/utils/cron-failure-bulk.ts'
const R = 'src/features/admin/api/admin-system-monitoring.routes.ts'
const T = 'src/tests/unit/cron-failure-bulk-resolve-2026-10-18.test.ts'

export default [
  {
    name: '🧹 일괄 해결 — before 시각 조건이 빠진다',
    file: U,
    find: "job_name LIKE ? ESCAPE '\\\\' AND created_at < ?",
    replace: "job_name LIKE ? ESCAPE '\\\\' AND ? IS NOT NULL",
    test: T,
    why: '시각 조건이 빠지면 수리 뒤에 울린 진짜 경보까지 함께 해결 처리된다.',
  },
  {
    name: '🧹 일괄 해결 — 밑줄이 아무 글자로 넓어진다',
    file: U,
    find: "const like = prefix.replace(/_/g, '\\\\_') + '%'",
    replace: "const like = prefix + '%'",
    test: T,
    why: "LIKE 의 '_' 는 아무 한 글자라, 이스케이프가 없으면 다른 이름의 경보가 함께 지워진다.",
  },
  {
    name: '🧹 일괄 해결 — super_admin 게이트가 사라진다',
    file: R,
    find: "    if (admin?.role !== 'super_admin') return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403)\n    const plan = planBulkResolve(",
    replace: '    const plan = planBulkResolve(',
    test: T,
    why: '데이터를 고치는 도구가 일반 관리자에게 열린다.',
  },
]
