/**
 * 🍽️ **캐시 + 오늘만 실시간** — 화면에 내보내는 통계의 계약 (2026-08-31).
 *
 * ## 왜 이렇게 나눴나
 * 이 표의 숫자는 **수집 회차가 만든다**(시간당 1회). 그래서 분포(업종·tier·소스)는 1시간 캐시로
 * 충분하고, 5분마다 다시 세는 것은 같은 답을 12번 구하는 짓이었다(회당 93만 행).
 *
 * **딱 하나 예외가 오늘 유입**이다 — 대표가 "수집이 살아 있나"를 보는 숫자다. 이게 낡으면
 * **멀쩡히 도는데 멈춘 것처럼 보인다.** 그건 성능이 아니라 오보다. 그래서 그것만 매번 다시 센다.
 *
 * ## 이 시험이 지키는 것
 * 1. 오늘 막대는 **덮어쓴다**(더하지 않는다 — 병합·삭제가 반영 안 되어 조용히 어긋난다)
 * 2. 캐시에 오늘 막대가 **없어도** 끼워 넣는다(자정 직후 0으로 보이면 안 된다)
 * 3. 어제 이전 막대는 **건드리지 않는다**(과거는 안 변한다)
 * 4. 오늘 조회가 실패해도 화면은 산다(캐시 값 그대로)
 *
 * ⚠️ 못 보는 것: 실제 읽는 행 수는 라이브 `meta.rows_read` 로만 판정된다(실측 7,234행).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMPANY_STATS_TTL_MS, COMPANY_STATS_MAX_STALE_MS } from '@/features/marketing/api/company-stats-cache'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const SERVE = SRC('src/features/marketing/api/company-stats-serve.ts')
const BREAKDOWN = SRC('src/features/marketing/api/company-breakdown.ts')
const ROUTE = SRC('src/features/marketing/api/partner-pool.routes.ts')

describe('⏱️ 수명이 수집 주기에 맞춰져 있다', () => {
  it('🔒 TTL 이 수집 회차(시간당 1회)와 같은 눈금 — 더 짧으면 같은 답을 여러 번 구한다', () => {
    expect(COMPANY_STATS_TTL_MS).toBeGreaterThanOrEqual(30 * 60_000)
    expect(COMPANY_STATS_TTL_MS, '너무 길면 분포가 하루씩 낡는다').toBeLessThanOrEqual(3 * 60 * 60_000)
  })

  it('🔒 낡은 값 한계가 TTL 보다 커야 stale-while-revalidate 가 성립한다', () => {
    // 한계 <= TTL 이면 낡은 값 구간이 **존재하지 않아** 항상 동기 계산이 된다(조용한 무력화).
    expect(COMPANY_STATS_MAX_STALE_MS).toBeGreaterThan(COMPANY_STATS_TTL_MS)
  })
})

describe('📅 오늘 유입 — 캐시에서 꺼내지 않고 매번 다시 센다', () => {
  it('🔒 오늘 막대를 **덮어쓴다**(더하지 않는다 — 병합·삭제가 반영 안 된다)', () => {
    expect(SERVE).toMatch(/d\.d === today\.d \? \{ \.\.\.d, n: today\.n, reachable: today\.reachable \} : d/)
    expect(SERVE, 'total 에 오늘치를 더하는 추정은 조용히 어긋난다').not.toMatch(/total:\s*stats\.stats\.total\s*\+/)
  })

  it('🔒 캐시에 오늘 막대가 없으면 끼워 넣는다 — 자정 직후 0 으로 보이면 안 된다', () => {
    expect(SERVE).toMatch(/if \(!byDay\.some\(d => d\.d === today\.d\)\) byDay\.unshift\(today\)/)
  })

  it('🔒 실패하면 캐시 값을 그대로 쓴다 — 오늘 숫자가 잠깐 낡는 게 화면이 죽는 것보다 낫다', () => {
    expect(SERVE).toMatch(/if \(!today\) return \{ stats, at \}/)
    expect(BREAKDOWN, '실패를 0 으로 적으면 "오늘 0건"이라는 거짓말이 된다').toMatch(/if \(!r \|\| !r\.d\) return null/)
  })

  it('🔒 오늘 경계는 **서버가** 정한다 — 클라 기준이면 브라우저 TZ 로 9시간 어긋난다', () => {
    expect(BREAKDOWN).toMatch(/DATE\('now','\+9 hours'\) AS d/)
    expect(BREAKDOWN, '날짜 비교도 KST 로').toMatch(/DATE\(collected_at,'\+9 hours'\) = DATE\('now','\+9 hours'\)/)
  })

  it('🔒 오늘치만 읽는다 — 범위 조건이 빠지면 다시 전수 스캔이다(실측 7,234 → 46만)', () => {
    expect(BREAKDOWN).toMatch(/collected_at >= datetime\('now','-1 days'\)/)
  })
})

describe('🔌 배선 — 라우트가 이 경로를 탄다', () => {
  it('/stats 가 serveCompanyStats 를 부른다(캐시만 부르면 오늘이 낡는다)', () => {
    expect(ROUTE).toMatch(/serveCompanyStats\(statsDb, fresh\w*, p => c\.executionCtx\?\.waitUntil\(p\)\)/)
    expect(ROUTE, '라우트가 집계를 직접 부르면 이 분리가 무의미하다').not.toMatch(/companyStats\(statsDb\)/)
  })
})
