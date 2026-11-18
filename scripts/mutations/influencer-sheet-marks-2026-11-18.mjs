/**
 * 🧬 주입 — 인플루언서 시트 '이메일 보냄' 표시 (2026-11-18)
 *    가드: src/tests/unit/influencer-sheet-marks-2026-11-18.test.ts
 */
const T = 'src/tests/unit/influencer-sheet-marks-2026-11-18.test.ts'
const S = 'src/features/marketing/api/sheets-sync.ts'
const M = 'src/features/marketing/api/pool-sheets-marks.ts'
export default [
  { name: '인플 시트 표시 — 첫 연락일을 덮어쓴다', file: M,
    find: "SET contacted_at = COALESCE(contacted_at, datetime('now')), contact_channel = 'email',", replace: "SET contacted_at = datetime('now'), contact_channel = 'email',", test: T,
    why: '오래전 첫 연락일이 오늘로 바뀌어 30일 쿨다운·후속 판단이 틀어진다.' },
  { name: '인플 시트 표시 — 공용 풀 밖도 건드린다', file: M,
    find: '    WHERE account_id = 0 AND ${match} AND NOT', replace: '    WHERE ${match} AND NOT', test: T,
    why: '다른 계정(광고주)의 리드까지 연락함으로 바뀐다.' },
  { name: '인플 시트 표시 — 이메일 매칭이 인덱스를 못 탄다', file: M,
    find: `    : "LOWER(email) IN (SELECT LOWER(value) FROM json_each(?))"`, replace: `    : "email IN (SELECT value FROM json_each(?))"`, test: T,
    why: '대문자 이메일이 안 맞고, 붙여넣을 때마다 58만 행 전수를 읽는다.' },
  { name: '인플 시트 표시 — DB 를 읽은 뒤에 표시를 저장한다', file: S,
    find: "    marked += await harvestMarks(DB, token, sheetId, 'ad_influencer_leads', TAB, MARK_LETTER, off + 2, take, cost).catch(() => 0)\n", replace: '', test: T,
    why: '시트에 적은 표시가 덮어쓰기에 지워지고 DB 에도 안 남는다.' },
  { name: '인플 시트 표시 — 열 수가 바뀌어도 사이클을 이어 간다', file: S,
    find: '  const cur = cur0.off > 0 && parseCursorCols(cRaw?.value) !== SHEET_HEADER.length ? { off: 0, total: 0 } : cur0', replace: '  const cur = cur0', test: T,
    why: '좁은 그리드에 31열을 써서 400 → 커서가 그 자리에 고착된다.' },
  { name: '인플 시트 표시 — DM 연락일도 이메일 보냄으로 그린다', file: S,
    find: "    sentDayKST(l.contact_channel === 'email' ? l.contacted_at : null)]", replace: '    sentDayKST(l.contacted_at)]', test: T,
    why: 'DM 만 보낸 사람이 이메일을 받은 것처럼 보여 발송에서 빠진다.' },
]
