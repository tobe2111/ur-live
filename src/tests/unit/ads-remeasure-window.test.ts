/**
 * 🔁 **재측정 주기** — 2026-09-03 (유료 전환 후 쓰기 2배 초과).
 *
 * ## 지키는 것
 * ① 순수 판정 — 한 번도 안 잰 행은 **항상** 통과(그게 이메일을 만든다: 측정 22.8% vs 미측정 1.3%)
 * ② fail-open — 스탬프를 못 읽으면 잰다(반대로 하면 측정이 조용히 멎는다)
 * ③ UTC 파싱 — D1 은 `'YYYY-MM-DD HH:MM:SS'`(Z 없음)를 준다. 로컬로 오해석하면 9시간 어긋난다
 * ④ 끔(0) = 종전 동작
 * ⑤ 배선 — 두 레인이 실제로 거른다 · `perf_checked_at` 을 SELECT 한다(안 뽑으면 필터가 전부 통과)
 *
 * ## 이 시험이 못 막는 것
 * 실제 쓰기가 줄었는지. 그건 배포 후 D1 analytics 로만 판정한다(`rowsWritten` 하루 330만 → 38만 기대).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isRemeasureDue, dueForRemeasure, remeasureAfterDays, REMEASURE_AFTER_DAYS } from '@/features/marketing/api/influencer-remeasure-window'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)
const daysAgo = (n: number) => new Date(NOW - n * 86400_000).toISOString().slice(0, 19).replace('T', ' ')

const NAVER = readFileSync('src/features/marketing/api/influencer-performance.ts', 'utf8')
const TISTORY = readFileSync('src/features/marketing/api/influencer-tistory-performance.ts', 'utf8')

describe('재측정 주기 — 순수 판정', () => {
  it('① 한 번도 안 잰 행은 항상 통과 — 그게 이메일을 만드는 작업이다', () => {
    expect(isRemeasureDue(null, NOW, 30)).toBe(true)
    expect(isRemeasureDue(undefined, NOW, 30)).toBe(true)
    expect(isRemeasureDue('', NOW, 30)).toBe(true)
  })

  it('② 주기 안이면 건너뛰고, 넘으면 잰다', () => {
    expect(isRemeasureDue(daysAgo(1), NOW, 30)).toBe(false)
    expect(isRemeasureDue(daysAgo(29), NOW, 30)).toBe(false)
    expect(isRemeasureDue(daysAgo(31), NOW, 30)).toBe(true)
  })

  it('③ fail-open — 형식을 못 읽으면 잰다(반대면 측정이 조용히 멎는다)', () => {
    expect(isRemeasureDue('언젠가', NOW, 30)).toBe(true)
    expect(isRemeasureDue('not-a-date', NOW, 30)).toBe(true)
  })

  it('③ D1 의 Z 없는 UTC 를 로컬로 오해석하지 않는다(9시간 어긋남 방지)', () => {
    // 정확히 30일 전 + 1분. UTC 로 읽으면 '지났음', 로컬(KST)로 읽으면 9시간 모자라 '안 지났음'이 된다.
    const t = new Date(NOW - 30 * 86400_000 - 60_000).toISOString().slice(0, 19).replace('T', ' ')
    expect(isRemeasureDue(t, NOW, 30)).toBe(true)
    // ISO(Z 붙음)도 같은 결과 — 두 표기가 갈리면 소스에 따라 판정이 달라진다.
    expect(isRemeasureDue(t.replace(' ', 'T') + 'Z', NOW, 30)).toBe(true)
  })

  it('④ 0 이면 끔 = 종전 동작(전부 통과)', () => {
    expect(isRemeasureDue(daysAgo(0), NOW, 0)).toBe(true)
    expect(dueForRemeasure([{ perf_checked_at: daysAgo(1) }], { ADS_REMEASURE_AFTER_DAYS: '0' }, NOW)).toHaveLength(1)
  })

  it('④ env 파싱 — 빈값/이상값은 기본, 음수도 기본, 상한 365', () => {
    expect(remeasureAfterDays(undefined)).toBe(REMEASURE_AFTER_DAYS)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: '' })).toBe(REMEASURE_AFTER_DAYS)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: 'abc' })).toBe(REMEASURE_AFTER_DAYS)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: '-5' })).toBe(REMEASURE_AFTER_DAYS)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: '7' })).toBe(7)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: '99999' })).toBe(365)
    expect(remeasureAfterDays({ ADS_REMEASURE_AFTER_DAYS: '0' })).toBe(0)
  })

  it('🔒 기본값은 30일 — 매일 다시 재는 게 쓰기 2배 초과의 원인이었다', () => {
    expect(REMEASURE_AFTER_DAYS).toBe(30)
  })

  it('목록 필터 — 오래된 것만 남고 순서는 유지된다', () => {
    const rows = [{ perf_checked_at: null }, { perf_checked_at: daysAgo(40) }, { perf_checked_at: daysAgo(2) }]
    expect(dueForRemeasure(rows, undefined, NOW)).toEqual([rows[0], rows[1]])
  })
})

describe('재측정 주기 — 배선', () => {
  it('⑤ 두 레인이 실제로 거른다(모듈만 있고 안 쓰면 아무 일도 안 일어난다)', () => {
    expect(NAVER, '네이버 레인이 필터를 안 쓴다').toMatch(/dueForRemeasure\(rows, env\)/)
    expect(TISTORY, '티스토리 레인이 필터를 안 쓴다').toMatch(/dueForRemeasure\(res\?\.results \|\| \[\], env\)/)
  })

  it('⑤ SELECT 가 perf_checked_at 을 뽑는다 — 안 뽑으면 전부 undefined 라 필터가 통째로 무효', () => {
    for (const [name, src] of [['naver', NAVER], ['tistory', TISTORY]] as const) {
      const sel = /SELECT [^`]*?FROM ad_influencer_leads/s.exec(src)?.[0] || ''
      expect(sel, `${name} SELECT 를 못 찾았다`).toBeTruthy()
      expect(sel, `${name}: perf_checked_at 이 SELECT 목록에 없다`).toMatch(/perf_checked_at/)
    }
  })

  it('⑤ 정렬이 오래된 순 그대로 — 코드 필터가 SQL 조건과 같으려면 이 정렬이 전제다', () => {
    expect(NAVER).toMatch(/ORDER BY perf_checked_at ASC LIMIT \?/)
    expect(TISTORY).toMatch(/ORDER BY perf_checked_at ASC LIMIT \?/)
  })

  it('⑤ 건너뛴 수를 진단에 남긴다 — 없으면 "전부 신선"이 "큐가 빔"처럼 보인다', () => {
    expect(NAVER).toMatch(/diag\.fresh_skipped = fetched - rows\.length/)
  })
})
