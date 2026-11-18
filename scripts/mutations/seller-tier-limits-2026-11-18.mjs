/** 🧬 주입 — 셀러 등급별 이용권 월 한도 (2026-11-18) · 가드: src/tests/unit/seller-tier-limits-2026-11-18.test.ts */
const T = 'src/tests/unit/seller-tier-limits-2026-11-18.test.ts'
const F = 'src/worker/utils/seller-tier-limits.ts'
export default [
  { name: 'tierlimit: 실버가 브론즈 한도로', file: F, find: "silver: '실버'", replace: "silver: '브론즈'", test: T,
    why: '실버 셀러가 월 20개가 아니라 5개에서 막힌다.' },
  { name: 'tierlimit: 대소문자에 흔들린다', file: F, find: "CASE LOWER(COALESCE(s.tier, ''))", replace: "CASE COALESCE(s.tier, '')", test: T,
    why: '등급 코드가 대문자로 저장되면 모두 브론즈가 된다.' },
  { name: 'prewarm: 호출자 0 인 홈 묶음을 다시 예열', file: 'src/worker/cron/cache-prewarm.ts',
    find: 'const HOT_PATHS: readonly string[] = [\n', replace: "const HOT_PATHS: readonly string[] = [\n  '/api/home/bundle',\n", test: T,
    why: '아무도 안 받는 응답을 5분마다 만들어 하루 수백만 행을 읽는다.' },
]
