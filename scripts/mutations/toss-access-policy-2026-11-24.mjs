/** 🧬 주입 — 토스 API 키 접근 정책(IP 차단) 감지 (2026-11-24) · 가드: src/tests/unit/toss-key-probe.test.ts */
const T = 'src/tests/unit/toss-key-probe.test.ts'
export default [
  { name: 'tossaccess: IP 차단을 판정 불가로 넘긴다', file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'if (body && body.code === TOSS_ACCESS_DENIED_CODE) {', replace: 'if (false) {', test: T,
    why: '토스가 우리 서버 IP 를 막아도 자가진단이 조용히 넘어간다 — 결제 승인·환불이 전부 막힌 것을 첫 실결제에서야 안다.' },
  { name: 'tossaccess: 에러 안내표에서 접근 정책 코드가 빠진다', file: 'src/worker/utils/toss-error-messages.ts',
    find: '  API_KEY_ACCESS_DENIED:', replace: '  API_KEY_ACCESS_DENIED_X:', test: T,
    why: '막혔을 때 손님에게 가맹점 설정 문제라는 안내 대신 분류 없는 오류가 나간다.' },
]
