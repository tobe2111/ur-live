/**
 * 🗑️ 기록 표 보관 기간 (2026-11-18) — 주입 매니페스트.
 * 가드: src/tests/unit/log-retention-2026-11-18.test.ts
 */
const TEST = 'src/tests/unit/log-retention-2026-11-18.test.ts'

export default [
  {
    name: '🗑️ 로그아웃 경계 표(dashboard_sessions)를 청소 대상에 넣는다(끊은 토큰이 되살아난다)',
    file: 'src/worker/utils/log-retention.ts',
    find: "  { table: 'search_logs', column: 'created_at', days: 90,",
    replace: "  { table: 'dashboard_sessions', column: 'updated_at', days: 30, why: 'x' },\n  { table: 'search_logs', column: 'created_at', days: 90,",
    test: TEST,
    why: '계정당 1행이 강제 로그아웃 경계를 담는다 — 행이 없으면 옛 토큰을 유효로 본다.',
  },
  {
    name: '🗑️ 청소가 한도 없이 한 번에 다 지운다(쓰기 폭주)',
    file: 'src/worker/utils/log-retention.ts',
    find: '< ${cutoff} LIMIT ${RETENTION_BATCH})',
    replace: '< ${cutoff})',
    test: TEST,
    why: '처음 켜는 날 쌓인 행 전부가 한 문장으로 지워져 그 시간 DB 쓰기가 몰린다.',
  },
]
