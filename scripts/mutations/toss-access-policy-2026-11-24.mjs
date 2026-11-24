/** 🧬 주입 — 토스 API 키 접근 정책(IP 차단) 감지 (2026-11-24) · 가드: src/tests/unit/toss-key-probe.test.ts */
const T = 'src/tests/unit/toss-key-probe.test.ts'
export default [
  { name: 'tossaccess: IP 차단을 판정 불가로 넘긴다', file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'if (body && body.code === TOSS_ACCESS_DENIED_CODE) {', replace: 'if (false) {', test: T,
    why: '토스가 우리 서버 IP 를 막아도 자가진단이 조용히 넘어간다 — 결제 승인·환불이 전부 막힌 것을 첫 실결제에서야 안다.' },
  { name: 'tossaccess: 에러 안내표에서 접근 정책 코드가 빠진다', file: 'src/worker/utils/toss-error-messages.ts',
    find: '  API_KEY_ACCESS_DENIED:', replace: '  API_KEY_ACCESS_DENIED_X:', test: T,
    why: '막혔을 때 손님에게 가맹점 설정 문제라는 안내 대신 분류 없는 오류가 나간다.' },
  { name: 'tossaccess: 어드민 점검이 차단을 통과로 읽는다', file: 'src/worker/utils/toss-access-probe.ts',
    find: "if (code === 'API_KEY_ACCESS_DENIED') return 'blocked'", replace: "if (code === 'API_KEY_ACCESS_DENIED') return 'valid'", test: T,
    why: '해외 거점에서 토스가 막는데 점검이 초록으로 나와, 외국인 결제를 열어도 된다고 오판한다.' },
  { name: 'tossaccess: 어드민 점검이 거점 이름을 안 돌려준다', file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: '      colo: cf?.colo ?? null,\n', replace: '', test: T,
    why: '어느 거점에서 통과했는지 모르는 판정이 된다 — 한국 거점 통과를 해외 통과로 읽는다.' },
]
