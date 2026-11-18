/**
 * 🗂️ 무거운 조회 색인 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/heavy-query-indexes-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/heavy-query-indexes-2026-11-17.test.ts'

export default [
  {
    name: '🗂️ 깨진 상호 색인의 WHERE 가 조회와 어긋난다(플래너가 조용히 안 쓰고 전체를 훑는다)',
    file: 'src/features/marketing/api/company-ddl-indexes.ts',
    find: "ON ad_company_leads(id) WHERE merged_into IS NULL AND status = 'new' AND instr(company_name, char(65533)) > 0\",",
    replace: "ON ad_company_leads(id) WHERE merged_into IS NULL AND instr(company_name, char(65533)) > 0 AND status = 'active'\",",
    test: TEST,
    why: '부분 색인은 조회의 WHERE 가 색인 조건을 함의할 때만 쓰인다 — 하나만 달라도 경고 없이 예전처럼 2,470만 줄을 읽는다.',
  },
  {
    name: '🗂️ 리드 점수 재계산이 다시 모든 행을 쓴다(하루 ~27만 줄)',
    file: 'src/features/marketing/api/influencer-quality.ts',
    find: '&& Number(r.lead_score) === score) continue',
    replace: '&& Number(r.lead_score) === score && false) continue',
    test: TEST,
    why: '이 패스는 끝에서 커서가 0 으로 돌아 멈추지 않는다 — 안 바뀐 행까지 쓰면 쓰기가 풀 크기에 비례한다.',
  },
]
