/**
 * 🪞 **재조우 백필이 실제로 값을 바꾸는가** — `influencer-save.ts` 의 `backfillSql` 거울.
 *
 * ## 왜 있나 (2026-09-04 실측)
 * 발굴 레인은 같은 채널을 계속 다시 만난다(인기 블로그는 여러 키워드 검색에 걸린다). 재조우마다
 * 조건 없이 UPDATE 를 날리고 있었는데, **SQLite 는 값이 안 바뀌어도 행과 그 컬럼을 포함한 인덱스를
 * 전부 다시 쓴다**(이 테이블은 인덱스 13개). 실측:
 * ```
 *   새 리드 저장   시간당 약 600건
 *   실제 쓴 행     시간당 약 96,000   ← 신규 1건당 160행. INSERT 증폭으로는 설명 불가
 * ```
 * 즉 쓰기의 대부분이 **아무것도 안 바뀐 재기록**이었다. 그 쓰기가 하루 예산(120만)을 태워
 * 차단기를 8~12시간 만에 걸리게 하고, 남은 시간의 발굴을 통째로 멈춘다.
 *
 * ## ⚠️ 하면 안 되는 처방
 * "컨택이 비었을 때만 UPDATE" 로 좁히는 것. 2026-07-23(F-32)이 **정확히 그 상태를 고쳤다** —
 * 이미 컨택이 있는 리드는 구독자수·소개글이 영원히 수집 당시 값에 머물러, 재분류가 낡은 소개글로
 * 판정했다. 되돌리면 그 사고가 재발한다.
 * ⇒ 올바른 처방은 **범위 축소가 아니라 no-op 제거**다. 값이 달라질 때는 종전과 똑같이 쓴다.
 *
 * ## 계약
 * 이 함수는 `backfillSql` 의 SET 절과 **1:1 대응**해야 한다. 한쪽만 바뀌면 갱신을 조용히 건너뛰어
 * 위 F-32 회귀가 그대로 돌아온다 — 그래서 순수함수로 떼어 규칙마다 시험을 붙인다.
 * SQL 이 바뀌면 이 함수와 시험도 같은 커밋에서 바꿀 것.
 */

/** 저장된 현재 값(백필 대상 컬럼만). */
export type BackfillCurrent = {
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  links?: string | null
  subscriber_count?: number | null
  view_count?: number | null
  description?: string | null
  last_post_at?: string | null
  opted_out?: number | null
}

/** 이번에 만난 값 — 호출부가 SQL 에 바인딩하는 것과 **같은 형태**로 넘긴다(설명은 500자 절단 후). */
export type BackfillIncoming = {
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  links?: string | null
  subscriber_count?: number | null
  view_count?: number | null
  description: string
  last_post_at?: string | null
  optOut: 0 | 1
}

/**
 * `backfillSql` 이 이 행의 값을 실제로 바꾸는가.
 *
 * 각 절은 SQL 과 같은 뜻이다:
 * - `COALESCE(email, ?)`        → 저장값이 비었고 새 값이 있을 때만
 * - `CASE WHEN ? > 0 THEN ?`    → 새 값이 0 초과이고 저장값과 다를 때만
 * - `CASE WHEN ? != '' THEN ?`  → 새 소개글이 비어 있지 않고 저장값과 다를 때만
 * - `last_post_at`              → 새 날짜가 있고 저장값이 없거나 더 이를 때만
 * - `opted_out`                 → 이번에 거부 문구를 봤고 저장값이 아직 1 이 아닐 때만(sticky)
 */
export function backfillWouldChange(cur: BackfillCurrent, inc: BackfillIncoming): boolean {
  if (isBlank(cur.email) && !isBlank(inc.email)) return true
  if (isBlank(cur.instagram) && !isBlank(inc.instagram)) return true
  if (isBlank(cur.tiktok) && !isBlank(inc.tiktok)) return true
  if (isBlank(cur.links) && !isBlank(inc.links)) return true
  if ((inc.subscriber_count ?? 0) > 0 && (cur.subscriber_count ?? null) !== inc.subscriber_count) return true
  if ((inc.view_count ?? 0) > 0 && (cur.view_count ?? null) !== inc.view_count) return true
  if (inc.description !== '' && (cur.description ?? null) !== inc.description) return true
  if (inc.last_post_at != null && (cur.last_post_at == null || cur.last_post_at < inc.last_post_at)) return true
  if (inc.optOut === 1 && (cur.opted_out ?? 0) !== 1) return true
  return false
}

/**
 * `COALESCE` 는 NULL 만 채우므로 저장값이 `''` 이면 SQL 은 그대로 둔다. 여기서는 `''` 도 "없음"으로 봐서
 * **일부러 더 관대하게** 판정한다 — 그 경우 UPDATE 가 한 번 더 돌 뿐이고(쓰기 낭비 소량), 반대로
 * 좁게 잡으면 **진짜 갱신을 건너뛰어** F-32 스테일 회귀가 난다. 애매하면 쓰는 쪽으로 기운다.
 */
function isBlank(v: string | null | undefined): boolean {
  return v == null || v === ''
}
