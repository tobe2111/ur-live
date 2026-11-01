/**
 * 🧬 주입 — 보강 큐: 미착수가 재시도보다 먼저다 (2026-10-24 대표 "이메일 수집도 더 잘 되면 좋겠음")
 *    가드: src/tests/unit/enrich-virgin-first-2026-10-24.test.ts
 */
const T = 'src/tests/unit/enrich-virgin-first-2026-10-24.test.ts'
const L = 'src/features/marketing/api/enrich-lane.ts'
const A = 'src/tests/unit/company-read-amplification.test.ts'
const X = 'src/features/marketing/api/company-ddl-indexes.ts'
export default [
  {
    name: '보강큐 — 인덱스 선두 키를 ORDER BY 와 어긋나게 둔다(전수 정렬 복귀)',
    file: X,
    find: "     (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),\n     (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END),",
    replace: "     (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END),\n     (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),",
    test: A,
    why: '키 순서가 어긋나면 플래너가 인덱스를 **경고 없이 무시**하고 33만 행을 임시 B-트리로 정렬한다(회당 70만 행 읽기 재발).',
  },
  {
    name: '보강큐 — 인덱스 이름을 옛 것으로 되돌린다(라이브에 안 만들어진다)',
    file: X,
    find: 'idx_company_leads_enrich_order_v2',
    replace: 'idx_company_leads_enrich_order',
    test: A,
    why: '`CREATE INDEX IF NOT EXISTS` 는 같은 이름이 있으면 컬럼이 달라도 아무것도 안 한다 — 라이브엔 옛 4키 인덱스가 남아 조용히 무시된다.',
  },
  {
    name: '보강큐 — 옛 인덱스 DROP 을 뺀다(쓰이지 않는 인덱스가 쓰기 비용만 낸다)',
    file: X,
    find: "  'DROP INDEX IF EXISTS idx_company_leads_enrich_order',",
    replace: '',
    test: A,
    why: '41만 행 테이블에 쓰이지 않는 인덱스가 남아 모든 UPDATE/INSERT 가 그 인덱스까지 다시 쓴다.',
  },
  {
    name: '보강큐 — 미착수 우선 키를 제거한다(옛 순서 복귀)',
    file: L,
    find: "      ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),\n               (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END),",
    replace: "      ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),",
    test: T,
    why: '이미 실패한 사이트 보유 행(webkr 6,600 · local 2,998)이 미착수 2,842 보다 다시 앞을 차지한다.',
  },
  {
    name: '보강큐 — 미착수를 첫 키로 올린다(수율 0 인 보류 36만 건이 큐를 독식)',
    file: L,
    find: "      ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),\n               (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END),",
    replace: "      ORDER BY (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END),\n               (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),",
    test: T,
    why: '미착수의 87%가 commerce(36만, 사이트 0.4%)이고 그쪽 크롤 수율은 실측 0 이다 — 이메일이 69 → 거의 0 으로 떨어진다. 이 세션이 실제로 한 번 틀렸던 방향이다.',
  },
  {
    name: '보강큐 — 재시도 쿨다운 조건을 제거한다(미착수 소진 후 수집이 멎는다)',
    file: L,
    find: "enrich_checked_at < datetime('now', '-7 days')",
    replace: "enrich_checked_at < datetime('now', '-9999 days')",
    test: T,
    why: '미착수가 바닥나면 큐가 비어 보강이 통째로 멎는다 — 재시도를 버리는 것이 아니라 뒤로 미루는 설계다.',
  },
  {
    name: '보강큐 — 출처별 발견 수율 계수를 없앤다',
    file: L,
    find: "      bump(`ns_src_${t.source || 'unknown'}`)",
    replace: "      // (계수 제거)",
    test: T,
    why: '이 변경의 판정 근거가 사라진다 — 2026-07-29 가 남긴 "출처별 발견 수율" 질문에 영영 답할 수 없다.',
  },
  {
    name: '보강큐 — 사이트 없는 리드 슬롯 상한을 없앤다',
    file: L,
    find: 'export const NO_SITE_SLOT_SHARE = 0.5',
    replace: 'export const NO_SITE_SLOT_SHARE = 1',
    test: T,
    why: '수율 0 인 다수(사이트 없음)가 예산을 독식해 즉시 크롤 가능분이 밀린다(2026-07-29 실측 근거).',
  },
]
