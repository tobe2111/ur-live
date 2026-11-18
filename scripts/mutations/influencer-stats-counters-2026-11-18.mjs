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
  { name: '증분 — 조각이 상한을 넘겨 센다', file: F,
    find: '  const hi = Math.min(lo + width - 1, max)', replace: '  const hi = lo + width - 1', test: T,
    why: '채우기 시작 뒤 들어온 행을 트리거와 조각이 두 번 센다.' },
  { name: '증분 — 트리거가 안 센 구간에도 반응한다', file: F,
    find: "AFTER UPDATE OF ${WATCHED_COLUMNS.join(', ')} ON ad_influencer_leads WHEN ${counted('NEW.')} BEGIN", replace: "AFTER UPDATE OF ${WATCHED_COLUMNS.join(', ')} ON ad_influencer_leads BEGIN", test: T,
    why: '채우는 동안 아직 안 센 행의 변화가 더해져, 나중에 그 조각을 셀 때 이중 계산된다.' },
  { name: '증분 — 같은 조각을 두 번 센다(소유 표식 무시)', file: F,
    find: "WHERE k = '${BOOT_TOKEN}' AND (SELECT n FROM ${COUNTER_TABLE} WHERE k = '${BOOT_CURSOR}') = ?`, binds: [token, lo] },", replace: "WHERE k = '${BOOT_TOKEN}'`, binds: [token] },", test: T,
    why: '두 isolate 가 같은 조각을 잡으면 그 구간이 두 번 더해진다.' },
  { name: '증분 — 트리거를 새로 깔면서 다시 채우지 않는다', file: F,
    find: '      await DB.batch([...rebuildStatements(), ...triggers', replace: '      await DB.batch([...triggers', test: T,
    why: '트리거가 없던 동안의 쓰기가 빠진 숫자를 맞는 값처럼 보여 준다.' },
  { name: '증분 — 어긋나도 다시 채우지 않는다', file: F,
    find: '  await DB.batch(rebuildStatements().map(s => DB.prepare(s.sql).bind(...s.binds))).catch(e => recordCounterError(DB, \'rebuild\', e))', replace: '', test: T,
    why: '숫자표가 틀어져도 영영 그 값을 보여 준다.' },
]
