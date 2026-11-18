/**
 * 🧬 주입 — 펴면 '안 보냄'(업체·매장) (2026-11-18)
 *    가드: src/tests/unit/pool-sheets-unhide-2026-11-18.test.ts
 */
const T = 'src/tests/unit/pool-sheets-unhide-2026-11-18.test.ts'
const H = 'src/features/marketing/api/pool-sheets-hidden.ts'
export default [
  { name: '되돌리기 — 날짜 없는 줄도 되돌린다', file: H,
    find: '    if (SHEET_DATE.test(mark)) unhiddenDated.push(id)', replace: '    unhiddenDated.push(id)', test: T,
    why: '방금 "o" 를 적은 줄이 바로 다시 안 보냄이 된다.' },
  { name: '되돌리기 — 50줄 상한을 뺀다', file: H,
    find: '  if (unhiddenDated.length > UNHIDE_MAX_PER_RANGE) {', replace: '  if (false) {', test: T,
    why: '전체 선택 → 숨기기 취소 한 번에 보낸 기록이 통째로 지워진다.' },
  { name: '되돌리기 — 숨기기 실패 뒤에도 되돌린다', file: H,
    find: '  if (failAt && nowMs - failAt >= 0 && nowMs - failAt < HIDE_FAIL_QUIET_MS) { out.skipped = true; return out }', replace: '', test: T,
    why: '우리 숨기기가 실패해 펴진 줄을 사람이 편 것으로 읽어 기록을 지운다.' },
  { name: '되돌리기 — 원래 연락함이던 업체도 새 리드로', file: H,
    find: "    ? `, status = CASE WHEN status = 'contacted' AND contacted_at = email_sent_at THEN 'new' ELSE status END,", replace: "    ? `, status = CASE WHEN status IN ('contacted','interested') THEN 'new' ELSE status END,", test: T,
    why: '시트 표시 전부터 진행 중이던 업체의 상태가 지워진다.' },
]
