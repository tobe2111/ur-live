/**
 * 🗂️ **업체 리드 테이블(`ad_company_leads`) 인덱스 SSOT** — `company-discovery.ts` 의 `COMPANY_DDL` 에
 * 그대로 펼쳐진다(`...COMPANY_INDEX_DDL`). 분리한 이유는 크기가 아니라 **근거가 길어서**다:
 * 아래 두 개는 "있으면 좋은 것"이 아니라 **없으면 하루 1억 행을 헛읽는** 항목이라 사연을 적어 둬야 한다.
 *
 * ## 📉 왜 인덱스가 D1 무료 한도의 문제인가 (2026-08-27 라이브 실측)
 * D1 무료 한도는 **저장 용량이 아니라 읽은 행 수**로 매겨진다. 그런데 업체 DB 는 하루 읽기쿼리가
 * **1,571건뿐인데 3.91억 행**을 읽고 있었다 — 쿼리당 24.9만 행 = *거의 모든 읽기가 전수 스캔*
 * (테이블은 373,336행). 즉 문제는 "쿼리가 많다"가 아니라 **"한 번 물어볼 때마다 테이블을 통째로 훑는다"** 였다.
 *
 * ⚠️ 인덱스를 지우거나 이름·컬럼 순서를 바꾸면 **에러 없이** 그 상태로 되돌아간다. 배포는 초록이고
 *   한도만 조용히 다시 찬다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 의 전형이다.
 */
export const COMPANY_INDEX_DDL: readonly string[] = [
  'CREATE INDEX IF NOT EXISTS idx_company_leads_tier ON ad_company_leads(tier, id)',
  'CREATE INDEX IF NOT EXISTS idx_company_leads_region ON ad_company_leads(region, id)',
  'CREATE INDEX IF NOT EXISTS idx_company_leads_cat ON ad_company_leads(category, id)',
  'CREATE INDEX IF NOT EXISTS idx_company_leads_active ON ad_company_leads(active, tier, id)',

  /**
   * ① **"재분류할 게 있나"를 1행으로 답하기 위한 인덱스.**
   *
   * 재분류 배치는 `classified_v < 규칙버전` 인 행을 고르는데 **지금 대상은 0건**이다(남은 1,854행은
   * 전부 접힌 행이라 `merged_into IS NULL` 에서 빠진다). 그런데 쿼리가 `ORDER BY id ASC LIMIT n` 이라
   * 플래너가 PK 를 택해 **끝까지 걸어가서 빈손으로 돌아온다**:
   * ```
   *   회당 373,336행 × 시간당 5패스 × 24시간  =  4,480만 행/일
   *   그 대가로 얻는 것은 "할 일이 없다" 한 마디.
   * ```
   * ⚠️ `COALESCE(classified_v, -1)` 로 감싼 이유 — 원래 조건 `classified_v IS NULL OR classified_v < ?`
   *   는 범위가 둘로 갈려 인덱스 한 번으로 못 짚는다. **식(expression) 인덱스**로 한 범위로 만든다.
   *   짝: `reclassify-priority.ts` 의 `hasReclassifyWork()`(로컬 동일 데이터 재현 57ms → 0.07ms).
   */
  'CREATE INDEX IF NOT EXISTS idx_company_leads_classify_todo ON ad_company_leads(COALESCE(classified_v, -1), id) WHERE merged_into IS NULL',

  /**
   * ② **보강 대상 400건을 고르려고 33만 행을 정렬하던 것**을 멈추는 인덱스.
   *
   * `enrich-lane` 의 대상 쿼리는 `WHERE` 가 331,641행을 통과시키고 `ORDER BY` 가 그 전부를 임시
   * B-트리로 정렬한 뒤 앞의 400건만 쓴다 — 회당 704,977행 × 하루 105회차 = **7,400만 행/일**.
   * 인덱스가 그 정렬 순서를 그대로 담으면 플래너는 앞에서 400건만 걷고 멈춘다.
   * 로컬 동일 분포 재현: **86.5ms → 0.3ms, 결과 집합은 동일**.
   *
   * ⚠️ 컬럼 순서·`DESC`·부분조건이 쿼리의 `ORDER BY`/`WHERE` 와 **정확히** 같아야 효과가 난다.
   *   하나라도 어긋나면 플래너가 이 인덱스를 그냥 무시하고 예전처럼 전수 정렬한다(경고 없음).
   *   ⇒ `enrich-lane.ts` 의 ORDER BY 를 고치면 **여기도 같은 커밋에서** 고칠 것. 유닛이 짝을 강제한다.
   */
  `CREATE INDEX IF NOT EXISTS idx_company_leads_enrich_order ON ad_company_leads(
     (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),
     (CASE WHEN tier = 1 THEN 0 ELSE 1 END), active, id DESC) WHERE merged_into IS NULL`,
]
