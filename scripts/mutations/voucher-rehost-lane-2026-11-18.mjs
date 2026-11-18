/** 🧬 주입 — 교환권 사진 옮기기 길 전체 쉬기 (2026-11-18) · 가드: src/tests/unit/voucher-image-rehost-2026-10-31.test.ts */
const T = 'src/tests/unit/voucher-image-rehost-2026-10-31.test.ts'
const F = 'src/worker/cron/voucher-image-rehost.ts'
export default [
  { name: 'rehostlane: 막혀도 계속 두드린다', file: F,
    find: '  return fails >= LANE_FAIL_LIMIT ? { fails: 0, pausedUntil: now + LANE_PAUSE_MS } : { fails, pausedUntil: 0 }',
    replace: '  return { fails, pausedUntil: 0 }', test: T,
    why: '해외 IP 를 막는 원본에 매시간 4장씩 49초를 쓰며 영원히 실패한다.' },
  { name: 'rehostlane: 한 장 성공해도 안 풀린다', file: F,
    find: '  if (migrated > 0) return { fails: 0, pausedUntil: 0 }', replace: '', test: T,
    why: '길이 다시 열려도 실패 횟수가 남아 곧 다시 쉰다.' },
]
