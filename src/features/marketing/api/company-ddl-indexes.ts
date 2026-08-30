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
  /**
   * ③ **카카오 전화 스윕이 60건 뽑으려고 31만 행을 정렬하던 것**을 멈추는 인덱스 (2026-08-30).
   *
   * 창 함수(`ROW_NUMBER() OVER (PARTITION BY source …)`)는 전 대상의 등수를 다 매겨야 바깥
   * `LIMIT` 를 걸 수 있어 인덱스로도 안 줄었다(실측 800ms → 453ms). 그래서 쿼리를
   * **[소스별 상위 N] + [코드 인터리브]** 로 바꿨고, 이 인덱스가 그 "소스별 상위 N" 을 받는다.
   * 컬럼 순서는 `kakao-sweep-query.ts` 의 `KAKAO_SWEEP_INNER_ORDER` 와 **정확히 같아야** 한다.
   * 로컬 동일 분포 재현: **800ms → 0.6ms, 뽑히는 60행이 순서까지 동일**.
   *
   * 🩸 **여기 있던 "소스 목록도 인덱스만으로 답한다(0.0ms)" 는 틀렸다**(2026-08-30 라이브 재측정).
   *   `DISTINCT source` 는 라이브에서 355,231행을 읽는다 — 30일 쿨다운이 이 부분조건에 없어서
   *   선두 컬럼으로 건너뛰지 못하고, 쿨다운을 빼도 SQLite 가 skip-scan 을 안 한다. 그래서 그 조회는
   *   **결과를 TTL 캐시**한다(`kakao-sweep-query.ts` `SWEEP_SOURCES_TTL_MS`). 목록을 코드에 박지
   *   않는다는 원칙은 그대로다(박으면 새 수집기의 소스가 영원히 굶는다).
   */
  `CREATE INDEX IF NOT EXISTS idx_company_leads_kakao_queue ON ad_company_leads(
     source, (kakao_checked_at IS NOT NULL), (email IS NOT NULL AND email <> ''),
     (tier IS NULL), tier, id)
     WHERE merged_into IS NULL AND address IS NOT NULL AND address != '' AND (phone IS NULL OR phone = '')`,
  /**
   * ④ **수집 레인이 15건 뽑으려고 40만 행을 훑던 것** (2026-08-30, ③ 과 같은 클래스).
   *
   * ```
   *   company-collect 이메일 크롤 대상 :  라이브 rows_read 402,363  →  돌려주는 행 15
   *   결정적 조건만으로 좁히면            :  7,046행 (전체 396,208 의 1.8%)
   * ```
   * 대상이 이렇게 작은데 40만을 읽던 이유는 `ORDER BY (tier=1 우선), id DESC` 를 받는 인덱스가
   * 없어 **전수 정렬**했기 때문이다(`SCAN … USE TEMP B-TREE FOR ORDER BY`).
   *
   * 🔑 `source IN ('local','webkr')` 를 **인덱스 키가 아니라 부분조건에 둔다** — 리터럴이라 결정적이고,
   *   그래야 정렬 키가 `(tier1 우선, id DESC)` 하나로 남아 **정렬 자체가 사라진다**(소스별로 나눠
   *   뽑아 코드에서 합칠 필요도 없다). 로컬 실측: `SCAN + TEMP B-TREE` → `SCAN USING INDEX`, 결과 동일.
   *
   * ⚠️ 쿨다운(`enrich_checked_at`/`enrich_v`)은 **부분조건에 넣을 수 없다**(`datetime('now')` 는
   *   비결정적). 인덱스를 걸으며 거르는데, 결정적 집합 7,046 중 절반이 통과하므로 걷는 거리는 짧다.
   * ⚠️ 이 부분조건·정렬은 `company-collect.ts` 의 크롤 대상 쿼리와 **정확히 같아야** 한다.
   *   한 글자만 어긋나도 플래너가 조용히 무시하고 40만 행 정렬로 돌아간다.
   */
  `CREATE INDEX IF NOT EXISTS idx_company_leads_crawl_queue ON ad_company_leads(
     (CASE WHEN tier = 1 THEN 0 ELSE 1 END), id DESC)
     WHERE merged_into IS NULL AND source IN ('local','webkr')
       AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '')`,
  /**
   * ⑤ **일자별 유입이 39만 행을 훑던 것** (2026-08-31).
   *
   * 화면 맨 위의 "요즘 얼마나 들어오나" 막대는 최근 14일만 보는데, `collected_at` 에 인덱스가 없어
   * **전수 스캔 + 정렬**이었다(라이브 실측 461,191행 — 테이블보다 크다). 범위 조회이므로 인덱스가
   * 그대로 먹는다.
   * ⚠️ `merged_into IS NULL` 은 쿼리의 조건과 **같아야** 부분 인덱스가 쓰인다.
   */
  `CREATE INDEX IF NOT EXISTS idx_company_leads_collected_at ON ad_company_leads(collected_at)
     WHERE merged_into IS NULL`,
]
