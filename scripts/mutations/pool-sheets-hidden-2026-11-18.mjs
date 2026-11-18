/**
 * 🧬 주입 — 행 숨기기 = '이메일 보냄' (2026-11-18)
 *    가드: src/tests/unit/pool-sheets-hidden-2026-11-18.test.ts
 */
const T = 'src/tests/unit/pool-sheets-hidden-2026-11-18.test.ts'
const H = 'src/features/marketing/api/pool-sheets-hidden.ts'
export default [
  { name: '숨김 표시 — 필터로 가려진 줄도 보냄으로 센다', file: H,
    find: '      if (!meta[i]?.hiddenByUser) continue', replace: '      if (!meta[i]) continue', test: T,
    why: '필터 보기로 잠깐 가린 줄이 전부 "보냄"으로 저장된다.' },
  { name: '숨김 표시 — 다시 숨기기 전에 펴지 않는다', file: H,
    find: '  const reqs: unknown[] = [prop(start, start + sent.length, false)]', replace: '  const reqs: unknown[] = []', test: T,
    why: '밀려 온 옛 숨김이 그대로 남아 안 보낸 곳이 계속 숨는다.' },
  { name: '숨김 표시 — 묶음 끝을 하나 덜 숨긴다', file: H,
    find: '    reqs.push(prop(start + i, start + j + 1, true))', replace: '    reqs.push(prop(start + i, start + j, true))', test: T,
    why: '보낸 줄 묶음의 마지막 줄이 안 숨겨진다.' },
  { name: '숨김 표시 — 파트너 시트가 덮어쓴 뒤에 거둔다', file: 'src/features/marketing/api/pool-sheets-sync.ts',
    find: '    marked += await harvestHidden(DB, token, sheetId, def.table, TAB, off + 2, take, cost)\n', replace: '', test: T,
    why: '사람이 숨긴 줄이 저장되기 전에 덮어써져 숨김이 다른 업체로 밀린다.' },
]
