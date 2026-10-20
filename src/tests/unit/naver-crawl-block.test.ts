/**
 * 🚧 **네이버 공개 페이지 크롤 차단 감지** (2026-08-04).
 *
 * ## 지키려는 것은 "멈추는 것"이 아니라 **잘못 배우지 않는 것**
 * ```
 *   차단 → 본문 0 → perf_checked_at 스탬프 → nb_measured(수율의 분모) 상승, nb_contacts 정체
 *        → suppressLowRotationYield 가 "이 키워드가 나쁘다"로 학습 → 영구 억제
 *        → 억제되면 증거가 갱신되지 않으므로 **차단이 풀려도 안 돌아온다**
 * ```
 * 그래서 차단 회차는 스탬프를 찍지 않는다(NULL 로 남겨 다음 회차가 다시 집는다).
 *
 * ⚠️ **이 시험이 못 보는 것**
 * - 네이버가 **200 + 빈 페이지**로 주는 소프트 차단. 상태코드로 판정 불가 — 일별 카운터를 사람이 볼 것.
 * - 실제 라이브에서 429/403 이 오는지. 이 환경은 `blog.naver.com` 이 프록시 밖이라 확인 불가.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  isBlockStatus, noteCrawlStatus, naverCrawlBlocked, crawlBlockSnapshot, __resetNaverCrawlBlock,
  BLOCK_STREAK_TRIP, BLOCK_STATUSES,
} from '@/features/marketing/api/naver-crawl-block'

beforeEach(() => __resetNaverCrawlBlock())

describe('판정 — 좁게 잡는다', () => {
  it('429·403 만 차단이다', () => {
    expect(BLOCK_STATUSES).toEqual([429, 403])
    expect(isBlockStatus(429)).toBe(true)
    expect(isBlockStatus(403)).toBe(true)
  })

  it("🔒 **타임아웃·DNS 는 차단이 아니다** — '느리다'는 '막혔다'가 아니다", () => {
    expect(isBlockStatus(null)).toBe(false)
    expect(isBlockStatus(undefined)).toBe(false)
    for (const s of [200, 404, 410, 500, 502, 503]) expect(isBlockStatus(s), `${s} 를 차단으로 셌다`).toBe(false)
  })

  it('🔒 404/410 을 차단으로 세면 안 된다 — 삭제·비공개 블로그는 정상적으로 흔하다', () => {
    for (let i = 0; i < BLOCK_STREAK_TRIP + 5; i++) noteCrawlStatus(404)
    expect(naverCrawlBlocked(), '없는 블로그 몇 개에 레인이 통째로 멈췄다').toBe(false)
  })
})

describe('연속 판정 — 하나는 그 블로그 사정, 여러 개면 우리 사정', () => {
  it(`연속 ${BLOCK_STREAK_TRIP}회에서 발동한다`, () => {
    for (let i = 0; i < BLOCK_STREAK_TRIP - 1; i++) noteCrawlStatus(429)
    expect(naverCrawlBlocked(), '경계 전에 발동하면 비공개 블로그 몇 개에 멈춘다').toBe(false)
    noteCrawlStatus(429)
    expect(naverCrawlBlocked()).toBe(true)
  })

  it('🔒 성공 한 번이면 연속이 풀린다 — 회복을 즉시 인정한다', () => {
    for (let i = 0; i < BLOCK_STREAK_TRIP - 1; i++) noteCrawlStatus(403)
    noteCrawlStatus(200)
    expect(crawlBlockSnapshot().streak).toBe(0)
    noteCrawlStatus(403); noteCrawlStatus(403)
    expect(naverCrawlBlocked(), '성공이 연속을 못 끊었다 — 한 번 막히면 영영 막힌 것으로 남는다').toBe(false)
  })

  it('🔒 예외(null)는 연속을 늘리지도 지우지도 않는다 — 무응답은 어느 쪽 증거도 아니다', () => {
    noteCrawlStatus(429); noteCrawlStatus(429)
    noteCrawlStatus(null)
    expect(crawlBlockSnapshot().streak, '무응답이 연속을 지웠다 — 차단 중 타임아웃 하나로 판정이 리셋된다').toBe(2)
    noteCrawlStatus(429)
    expect(naverCrawlBlocked()).toBe(true)
  })

  it('누적은 일별 기록용으로 따로 센다(연속과 다른 값)', () => {
    noteCrawlStatus(429); noteCrawlStatus(200); noteCrawlStatus(403)
    const s = crawlBlockSnapshot()
    expect(s.blocked).toBe(2)
    expect(s.ok).toBe(1)
    expect(s.streak).toBe(1)
  })
})

describe('🔌 배선 — 안 불리면 상수만 남는다', () => {
  const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const PERF = SRC('src/features/marketing/api/influencer-performance.ts')
  const DISC = SRC('src/features/marketing/api/influencer-discovery.ts')

  it('측정 레인이 **두 fetch 모두** 상태를 기록한다(하루 8천 요청의 자리)', () => {
    expect((PERF.match(/noteCrawlStatus\(/g) || []).length).toBeGreaterThanOrEqual(4) // rss·home × (ok·catch)
  })

  it('🔒 **차단이면 스탬프를 안 찍는다** — 이게 이 수리의 핵심이다', () => {
    // 실패 처리 블록 안에서, 스탬프 push 보다 **앞에** 차단 분기가 있어야 한다.
    const i = PERF.indexOf('diag.failed++')
    expect(i, '실패 처리 블록을 못 찾았다 — 코드가 옮겨갔나(낡은 지도)').toBeGreaterThan(0)
    const block = PERF.slice(i, i + 600)
    const guard = block.indexOf('naverCrawlBlocked()')
    const stamp = block.indexOf('perf_checked_at = datetime')
    expect(guard, '차단 가드가 사라졌다 — 막힌 회차가 백로그를 통째로 스탬프한다').toBeGreaterThan(-1)
    expect(stamp).toBeGreaterThan(-1)
    expect(guard, '가드가 스탬프보다 뒤에 있으면 아무것도 못 막는다').toBeLessThan(stamp)
  })

  it('측정 레인이 회차 말에 일별 기록을 남긴다', () => {
    expect(PERF).toMatch(/flushCrawlBlock\(DB, Date\.now\(\)\)/)
  })

  it('발굴 레인의 컨택 보충도 차단이면 멈춘다', () => {
    expect(DISC).toMatch(/outOfBudget\(opts\.budget\) \|\| naverCrawlBlocked\(\)/)
    expect((DISC.match(/noteCrawlStatus\(/g) || []).length).toBeGreaterThanOrEqual(4)
  })
})
