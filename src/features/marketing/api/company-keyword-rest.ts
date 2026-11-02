/**
 * 🛌 업체 수집 키워드의 **포화 휴식** (2026-11-02 대표 *"개선할 것들 최대한 알아봐"* → *"다 해줘"*).
 *
 * ## 왜
 * 라이브 실측: 키워드 5,965개 중 **2,628개가 저장 0**인데 결과는 평균 62건씩 찾았다 — 이웃 지역 키워드가 같은
 * 업체를 먼저 가져가서 *이 키워드에서는 새 업체가 안 나온다*(고갈이 아니라 포화). 그래도 회전 순번은 똑같이
 * 차지해서, 신규가 나오는 키워드가 다시 돌아오는 주기가 그만큼 길어졌다.
 *
 * ## 규칙
 * - **쉬게 한다**: 결과를 {@link REST_MIN_FOUND}건 이상 찾았는데 누적 신규가 0 → `active = 2`(포화 휴식).
 *   `active=1` 만 회전하므로 순번에서 빠진다. 사람이 끈 것(0)과 구분된다.
 * - **사람이 넣은 키워드는 건드리지 않는다**(`source = 'manual'`) — 대표가 일부러 넣은 것이다.
 * - **되돌린다**: 쉰 지 {@link REST_DAYS}일 지나면 자동으로 다시 1 — 새 업체가 생겼을 수 있다(영구 배제가 아니다).
 *   휴식 시각은 `last_run_at`(휴식 판정이 그 회차의 UPDATE 안에서 같이 일어나므로 그 값이 곧 휴식 시작).
 *
 * ⚠️ 회전은 `COUNT(active=1)` + OFFSET 창이라, 키워드가 쉬면 그 뒤 창이 한 칸씩 당겨진다(한 번 건너뛸 수 있다).
 *   쉬는 키워드는 회차당 최대 배치 크기만큼이라 그 영향은 작고, 건너뛴 키워드는 다음 바퀴에 돈다.
 * ⚠️ 새 열을 만들지 않는다 — `active` 의 값 하나(2)로 표현한다(라이브 스키마 사진·컬럼 가드를 늘리지 않으려고).
 */

/** 이만큼 찾고도 신규가 0 이면 포화로 본다(카카오 1회 = 최대 45건 — 한 번 반만 도는 것으로는 판정하지 않는다). */
export const REST_MIN_FOUND = 40
/** 쉰 키워드를 다시 돌리는 주기. */
export const REST_DAYS = 60
/** 포화 휴식 값 — 0(사람이 끔)·1(수집 중)과 다른 셋째 상태. */
export const KEYWORD_RESTING = 2

/**
 * 회차 UPDATE 의 `active = …` 식. SQLite 의 UPDATE 는 SET 안에서 **갱신 전 값**을 읽으므로,
 * 이번 회차 증분(`addSaved`·`addFound` 자리표시자)을 더해서 판정한다.
 */
export function keywordRestSql(addSaved: string, addFound: string): string {
  return `CASE WHEN active = 1 AND COALESCE(source, '') != 'manual'
      AND saved_total + ${addSaved} = 0 AND found_total + ${addFound} >= ${REST_MIN_FOUND}
    THEN ${KEYWORD_RESTING} ELSE active END`
}

/** 쉰 지 {@link REST_DAYS}일 지난 키워드를 다시 회전에 넣는다. @returns 쓴 D1 쿼리 수(호출부가 예산에서 뺀다). */
export async function paroleRestingKeywords(DB: D1Database): Promise<number> {
  await DB.prepare(`UPDATE ad_company_keywords SET active = 1
    WHERE active = ${KEYWORD_RESTING} AND (last_run_at IS NULL OR last_run_at < datetime('now', '-${REST_DAYS} days'))`).run().catch(() => null)
  return 1
}
