/**
 * 📅 **수집 타임라인** — DB 가 "며칠에 얼마나" 쌓였는지 (대표 요청 2026-08-02).
 *
 * 대표가 정한 네 축 중 **①  DB 수집**을 눈으로 확인하는 자리다. 지금까지 어드민이 보여준 건
 * *누적 총계*뿐이라 "언제 들어왔나 · 어제보다 늘었나 · 어느 날 멈췄나"를 알 수 없었다
 * (라이브 장애 판정에서 실제로 이게 없어 매번 하트비트를 손으로 뒤졌다).
 *
 * ## ⚠️ 시각 컬럼은 **DDL 이 진실이다** — 여기서 실제로 틀렸다
 * ```
 *   ad_influencer_leads  → collected_at   (influencer-schema.ts:34)
 *   ad_company_leads     → collected_at   (company-discovery.ts:131)
 * ```
 * 🔴 **2026-08-02 실사고**: 여기 `ad_company_leads` 를 `created_at` 으로 적어 배포했다.
 * D1 은 `no such column` 을 던졌고 조회부의 `.catch(() => null)` 이 그걸 삼켜 —
 * **에러 없이 `allTime: 0`** 이 나왔다. 17만 건짜리 풀이 화면에서 빈 것처럼 보였다.
 * 원인은 스키마를 `CREATE TABLE` 이 아니라 **다른 파일의 grep 한 줄**로 추정한 것이다.
 * ⇒ 유닛이 **DDL 원문을 읽어** 이 표를 검증한다(상수를 상수와 비교하면 영원히 통과한다 —
 *   첫 판이 정확히 그래서 못 잡았다).
 *
 * ## ⚠️ 날짜는 **KST** 다
 * D1 의 `datetime('now')`·`created_at` 은 **`Z` 없는 UTC 문자열**이다. 그대로 `DATE()` 하면
 * 한국 사용자에게 **하루가 밀린 날짜**를 보여준다(CLAUDE.md 의 UTC 오표기 사고 클래스 — 실사고 4건).
 * 그래서 `DATE(<컬럼>, '+9 hours')` 로 KST 달력일에 맞춘다. 같은 파일의 기존 관용구
 * (`influencer-pool-stats.ts:66` 의 `'+9 hours','start of day','-9 hours'`)와 같은 규약이다.
 */

/** 조회 가능한 풀. 새 풀을 추가하면 **여기와 아래 표 둘 다** 고쳐야 한다(유닛이 강제). */
export type PoolKind = 'influencer' | 'company'

/**
 * 풀별 테이블·시각 컬럼 SSOT.
 * 🔒 값을 바꾸려면 실제 스키마를 확인하고 유닛(`ads-pool-timeline.test.ts`)도 같이 고칠 것.
 */
export const POOL_SOURCE: Record<PoolKind, { table: string; tsColumn: string }> = {
  influencer: { table: 'ad_influencer_leads', tsColumn: 'collected_at' },
  company: { table: 'ad_company_leads', tsColumn: 'collected_at' },
}

/** 한 번에 조회할 수 있는 최대 일수 — 무한 range 로 D1 를 훑지 않게. */
export const TIMELINE_MAX_DAYS = 180
export const TIMELINE_DEFAULT_DAYS = 30

/** `?days=` 해석 — 비숫자/0/음수/과대는 **기본값·상한으로 클램프**(오타 하나로 500 이 나면 안 된다). */
export function resolveDays(raw: unknown): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n < 1) return TIMELINE_DEFAULT_DAYS
  return Math.min(TIMELINE_MAX_DAYS, Math.floor(n))
}

/**
 * 일자별 수집 건수 SQL.
 *
 * `DATE(col,'+9 hours')` = **KST 달력일**. 범위 조건도 같은 규약으로 잘라야 경계일이 어긋나지 않는다
 * — UTC 로 자르고 KST 로 묶으면 첫날/마지막날이 부분치가 된다.
 *
 * ⚠️ 테이블·컬럼은 `POOL_SOURCE` 에서만 온다(사용자 입력이 SQL 에 닿지 않는다).
 */
export function buildTimelineSql(pool: PoolKind, days: number): string {
  const { table, tsColumn } = POOL_SOURCE[pool]
  return `SELECT DATE(${tsColumn}, '+9 hours') AS d, COUNT(*) AS n
    FROM ${table}
    WHERE ${tsColumn} IS NOT NULL
      AND DATE(${tsColumn}, '+9 hours') >= DATE('now', '+9 hours', '-${Math.floor(days)} days')
    GROUP BY d ORDER BY d DESC`
}

export interface TimelineDay { date: string; count: number }
export interface PoolTimeline {
  pool: PoolKind
  days: number
  /** KST 일자 내림차순(최신 먼저). 수집이 없던 날은 **행 자체가 없다**(0 을 만들어 넣지 않는다). */
  rows: TimelineDay[]
  /** 이 구간 합계 — 누적 총계가 아니다(그건 stats 가 준다). */
  total: number
  /** 전체 누적(구간 밖 포함) — "언제부터 쌓였나"의 분모. */
  allTime: number
  /** 가장 오래된 수집일(KST). 풀이 비었으면 null. */
  since: string | null
}

interface D1Like {
  prepare(sql: string): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null> }
}

/** 한 풀의 타임라인. 개별 실패는 빈 결과로 떨어지고 **throw 하지 않는다**(한쪽이 죽어도 다른 쪽은 보여야 한다). */
export async function getPoolTimeline(DB: D1Like, pool: PoolKind, days: number): Promise<PoolTimeline> {
  const { table, tsColumn } = POOL_SOURCE[pool]
  const [dayRows, meta] = await Promise.all([
    DB.prepare(buildTimelineSql(pool, days)).all<{ d: string; n: number }>().catch(() => null),
    DB.prepare(`SELECT COUNT(*) AS n, MIN(DATE(${tsColumn}, '+9 hours')) AS since FROM ${table}`)
      .first<{ n: number; since: string | null }>().catch(() => null),
  ])
  const rows: TimelineDay[] = (dayRows?.results || [])
    .filter(r => r && r.d)
    .map(r => ({ date: String(r.d), count: Number(r.n) || 0 }))
  return {
    pool, days, rows,
    total: rows.reduce((a, r) => a + r.count, 0),
    allTime: Number(meta?.n) || 0,
    since: meta?.since ?? null,
  }
}
