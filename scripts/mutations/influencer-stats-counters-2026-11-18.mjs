/**
 * 🧬 주입 — 인플루언서 풀 통계 증분 집계 (2026-11-18)
 *    가드: src/tests/unit/influencer-stats-counters-2026-11-18.test.ts
 */
const T = 'src/tests/unit/influencer-stats-counters-2026-11-18.test.ts'
const F = 'src/features/marketing/api/influencer-stats-counters.ts'
export default [
  { name: '증분 — 고치기 트리거가 옛 값을 안 뺀다', file: F,
    find: "${upsertBody([...arms('NEW.', 1), ...arms('OLD.', -1)])}", replace: "${upsertBody([...arms('NEW.', 1)])}", test: T,
    why: '행이 고쳐질 때마다 숫자가 부풀어 총계가 실제보다 커진다.' },
  { name: '증분 — 감시 칸이 빠진다', file: F,
    find: "'contact_channel', 'consented_at', 'is_brand'", replace: "'contact_channel', 'is_brand'", test: T,
    why: '동의가 기록돼도 동의 수가 안 움직인다.' },
  { name: '증분 — 같은 키를 합치지 않는다', file: F,
    find: 'SELECT k, d FROM (SELECT k, SUM(d) AS d', replace: 'SELECT k, d FROM (SELECT k, MAX(d) AS d', test: T,
    why: '카테고리를 바꾼 행의 빼기가 사라져 옛 카테고리 숫자가 줄지 않는다.' },
  { name: '증분 — 자가 시험 실패에도 트리거를 남긴다', file: F,
    find: "        for (const n of TRIGGER_NAMES) await DB.prepare(`DROP TRIGGER IF EXISTS ${n}`).run().catch(() => null)\n", replace: '', test: T,
    why: '깨진 트리거가 남아 리드 표의 모든 쓰기(수집)가 실패한다.' },
  { name: '증분 — 트리거를 새로 깔아도 대조 표식을 남긴다', file: F,
    find: '      await DB.prepare(`DELETE FROM ${COUNTER_TABLE} WHERE k = ?`).bind(RECONCILED_KEY).run()\n', replace: '', test: T,
    why: '트리거가 없던 동안의 쓰기가 빠진 숫자를 맞는 값처럼 보여 준다.' },
]
