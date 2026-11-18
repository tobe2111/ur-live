/**
 * 🧬 주입 — 시트 '안내' 탭 (2026-11-18)
 *    가드: src/tests/unit/pool-sheets-guide-2026-11-18.test.ts
 */
const T = 'src/tests/unit/pool-sheets-guide-2026-11-18.test.ts'
const G = 'src/features/marketing/api/pool-sheets-guide.ts'
export default [
  { name: '시트 안내 — 버전이 같아도 매번 다시 쓴다', file: G,
    find: '  if (Number(row?.value) === GUIDE_VERSION) return false\n', replace: '', test: T,
    why: '매시간 시트에 쓰기 요청이 늘어 서브리퀘스트 예산을 태운다.' },
  { name: '시트 안내 — 쓰기 실패에도 버전을 남긴다', file: G,
    find: '  if (!w?.ok) return false\n', replace: '', test: T,
    why: '안내가 안 써졌는데 다시 시도하지 않는다.' },
  { name: '시트 안내 — 가리기 방법이 빠진다', file: G,
    find: "    '  ③ [조건별 필터링] → [비어 있음] → [확인]',\n", replace: '', test: T,
    why: '대표가 물은 바로 그 방법(보낸 곳 가리기)이 안내에 없다.' },
  { name: '시트 안내 — 파트너/매장 시트에서 안 부른다', file: 'src/features/marketing/api/pool-sheets-sync.ts',
    find: '  await syncGuideTab(DB, token, sheetId, pool, cost).catch(() => false)\n', replace: '', test: T,
    why: '업체·매장 시트에는 안내 탭이 안 생긴다.' },
]
