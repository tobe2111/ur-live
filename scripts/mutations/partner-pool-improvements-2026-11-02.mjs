/**
 * 🧬 주입 — 파트너 풀 개선 묶음 (2026-11-02, 대표 "2번 빼고 일단 다 해줘")
 *    가드: src/tests/unit/partner-pool-improvements-2026-11-02.test.ts
 */
const T = 'src/tests/unit/partner-pool-improvements-2026-11-02.test.ts'
const A = 'src/features/marketing/api/'
export default [
  { name: '개선① — 보강 대상에 이메일 있는 보류 행을 다시 끌어온다', file: A + 'enrich-lane.ts',
    find: "      WHERE (email IS NULL OR email = '')\n", replace: "      WHERE (active = 0 OR email IS NULL OR email = '')\n", test: T,
    why: '하루 5만 슬롯이 이메일 있는 행 건너뛰기에 쓰인다(skip_email 99.6%).' },
  { name: '개선③ — 도어웨이 거름을 뺀다', file: A + 'company-classify.ts',
    find: "    if (DOORWAY_WORD.test(name)) return reject('DOORWAY_SPAM')\n", replace: '', test: T,
    why: '남의 사이트에 심은 `○○ 벌초대행` 광고 페이지가 업체로 들어온다.' },
  { name: '개선③ — 새 탈락 사유를 지우는 쪽으로 보낸다', file: A + 'company-discovery.ts',
    find: "      if (HOLD_NOT_DELETE_REASONS.has(c.reason || '') && r.status === 'new' && !r.memo) {", replace: "      if (false) {", test: T,
    why: '새 규칙 하나로 라이브 행이 대량 DELETE 된다(결재 사항).' },
  { name: '개선⑤ — 사람이 넣은 키워드도 쉬게 한다', file: A + 'company-keyword-rest.ts',
    find: "  return `CASE WHEN active = 1 AND COALESCE(source, '') != 'manual'\n", replace: "  return `CASE WHEN active = 1\n", test: T,
    why: '대표가 일부러 넣은 키워드가 조용히 순번에서 빠진다.' },
  { name: '개선⑥ — 저장 실패를 다시 삼킨다', file: A + 'franchise-collect.ts',
    find: "diag: { configured: true, error, sample, ...(saveErr ? { save_error: saveErr } : {}) }", replace: 'diag: { configured: true, error, sample }', test: T,
    why: '93회 저장 0 의 원인이 다시 어디에도 안 남는다.' },
  { name: '개선⑦ — 조회 실패에도 커서를 넘긴다', file: A + 'business-status-sweep.ts',
    find: '        break // 이 묶음은 조회 못 했다', replace: '        continue // 이 묶음은 조회 못 했다', test: T,
    why: '조회 실패한 묶음의 행이 폐업 확인 없이 건너뛰어진다.' },
  { name: '개선⑨ — 국내 업종의 중국 메일까지 보류한다', file: A + 'company-lead-hygiene.ts',
    find: "  if (r.email && r.category === '온라인판매' && OVERSEAS_FREEMAIL.test(r.email)) {", replace: "  if (r.email && OVERSEAS_FREEMAIL.test(r.email)) {", test: T,
    why: '사람이 봐야 할 국내 업체가 조용히 보류된다.' },
]
