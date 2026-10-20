/**
 * 🎯 **외부 API 일일 목표 90%** (2026-08-04 대표 *"유료 api 각각 90%씩은 쓰자"*).
 *
 * ## 이 값이 왜 필요한가 — 늘리는 값이 아니라 멈추는 값이다
 * 실측(2026-08-04): 네이버 396/25,000(**1.6%**) · 유튜브 3,100/10,000(31%). 오늘의 병목은 쿼터가
 * 아니라 Cloudflare CPU·서브리퀘스트다 — 목표를 올려도 오늘 수집량은 1건도 안 는다.
 * 이게 사는 건 **유료 전환 이후**다: 서브리퀘스트 천장이 60→900(×15)이 되면 쿼터를 넘겨 429 를
 * 받기 시작하고, 그때는 회차 중간에 남은 작업이 통째로 버려진다(실패 호출도 쿼터를 먹는다).
 *
 * ⚠️ **이 시험이 못 보는 것**
 * - 실제 쿼터가 25,000/10,000 이 맞는지. 앱 설정에 따라 다르고 **진짜 근거는 429 응답**이다.
 * - 계측 밖의 사용(어드민 온디맨드 도구) — 그래서 100% 가 아니라 90% 를 겨눈다.
 * - **카카오**: 앱별 쿼터를 코드가 알 수 없어 게이트가 아직 없다(실측 360회/일 — 어떤 쿼터로도 1% 미만).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  noteNaverCall, armNaverDailyAllowance, naverAllowanceLeft, __resetNaverCallMeter,
  pendingNaverCalls, NAVER_DAILY_QUOTA_CALLS, NAVER_DAILY_TARGET_PCT, NAVER_DAILY_TARGET_CALLS,
} from '@/features/marketing/api/naver-api-usage'
import { YT_SEARCH_BUDGET_DEFAULT, YT_DAILY_TARGET_PCT } from '@/features/marketing/api/influencer-auto-collect'
// 쿼터·단가는 보강 레인이 SSOT — 수집 레인이 되import 하면 순환이라, **관계식을 여기서 잇는다.**
import { YT_DAILY_QUOTA_UNITS, YT_SEARCH_UNIT_COST } from '@/features/marketing/api/influencer-enrich-lane'

const OPENAPI = 'https://openapi.naver.com/v1/search/blog.json?query=x'
const NOT_QUOTA = 'https://m.blog.naver.com/someone' // 공개 페이지 — 쿼터를 안 먹는다

beforeEach(() => __resetNaverCallMeter())

describe('네이버 — 일일 목표 90%', () => {
  it('목표가 쿼터의 90% 다', () => {
    expect(NAVER_DAILY_TARGET_PCT).toBe(0.9)
    expect(NAVER_DAILY_TARGET_CALLS).toBe(Math.floor(NAVER_DAILY_QUOTA_CALLS * 0.9))
    expect(NAVER_DAILY_TARGET_CALLS).toBe(22_500)
  })

  it('🔒 **장전 전에는 무제한** — 무장을 잊은 레인이 조용히 멈추면 안 된다', () => {
    expect(naverAllowanceLeft()).toBeNull()
    for (let i = 0; i < 5; i++) expect(noteNaverCall(OPENAPI)).toBe(true)
    expect(pendingNaverCalls()).toBe(5)
  })

  it('장전하면 남은 만큼만 허용하고, 그 뒤로는 막는다', () => {
    armNaverDailyAllowance(NAVER_DAILY_TARGET_CALLS - 2)
    expect(naverAllowanceLeft()).toBe(2)
    expect(noteNaverCall(OPENAPI)).toBe(true)
    expect(noteNaverCall(OPENAPI)).toBe(true)
    expect(noteNaverCall(OPENAPI), '목표를 넘겨 쐈다 — 429 를 자초한다').toBe(false)
    expect(pendingNaverCalls(), '막힌 호출은 세면 안 된다(안 쐈으니까)').toBe(2)
  })

  it('이미 목표를 넘겼으면 0 — 음수로 내려가 되살아나지 않는다', () => {
    armNaverDailyAllowance(NAVER_DAILY_TARGET_CALLS + 9_999)
    expect(naverAllowanceLeft()).toBe(0)
    expect(noteNaverCall(OPENAPI)).toBe(false)
  })

  it('🔒 **쿼터를 안 먹는 URL 은 절대 안 막는다** — 공개 페이지 크롤은 이 게이트 소관이 아니다', () => {
    armNaverDailyAllowance(NAVER_DAILY_TARGET_CALLS) // 완전 소진 상태
    expect(noteNaverCall(OPENAPI)).toBe(false)
    expect(noteNaverCall(NOT_QUOTA), '오픈API 가 아닌데 막혔다 — 블로그 크롤이 통째로 죽는다').toBe(true)
    expect(noteNaverCall('https://www.youtube.com/x')).toBe(true)
  })

  it('🔒 남은 10% 는 안 쓴다 — 계측이 실사용의 하한이라 100% 를 겨누면 실제로는 넘긴다', () => {
    expect(NAVER_DAILY_TARGET_CALLS).toBeLessThan(NAVER_DAILY_QUOTA_CALLS)
  })
})

describe('유튜브 — 이미 90%. 우연이 아니라 계산이라는 걸 고정한다', () => {
  it('검색 예산 = 쿼터 × 90% ÷ 검색단가', () => {
    expect(YT_DAILY_TARGET_PCT).toBe(0.9)
    expect(YT_SEARCH_UNIT_COST, 'search.list 는 1회 100 units').toBe(100)
    expect(YT_SEARCH_BUDGET_DEFAULT).toBe(Math.floor((YT_DAILY_QUOTA_UNITS * 0.9) / YT_SEARCH_UNIT_COST))
    expect(YT_SEARCH_BUDGET_DEFAULT).toBe(90)
  })

  it('🔒 100 으로 올리면 성과측정 몫이 0 이 된다 — 남은 units 가 양수여야 한다', () => {
    const left = YT_DAILY_QUOTA_UNITS - YT_SEARCH_BUDGET_DEFAULT * YT_SEARCH_UNIT_COST
    expect(left, '측정(각 1 unit) 예약분이 사라졌다 — 2026-07-27 실사고 재현').toBeGreaterThan(0)
    expect(left).toBe(1_000)
  })
})

describe('🔌 배선 — 게이트가 안 불리면 상수만 남고 아무도 안 막힌다', () => {
  const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('수집 레인이 회차 시작에 장전한다', () => {
    expect(SRC('src/features/marketing/api/influencer-auto-collect.ts'))
      .toMatch(/armNaverDailyAllowance\(parseNaverUsed\(settings\[NAVER_USED_KEY\]/)
  })

  it.each([
    ['src/features/marketing/api/fetch-with-err.ts', /if \(!noteNaverCall\(url\)\) return \{ res: null/],
    ['src/features/marketing/api/contact-enrich.ts', /if \(!noteNaverCall\(url\)\) \{[\s\S]{0,120}return null \}/],
    // 🚚 2026-08-22: `laneFetch` 가 `webkr-search.ts` 로 이사했다(웹문서 전용 레인이 같은 함수를 쓴다).
    //   ⚠️ 파일 경로만 옮긴 것 — 지키는 불변식은 그대로다(네이버 레인 fetch 는 반드시 계측 게이트를 통과).
    ['src/features/marketing/api/webkr-search.ts', /if \(!noteNaverCall\(url\)\) return null/],
  ])('%s 가 반환값을 실제로 본다 — 무시하면 게이트가 헛돈다', (file, re) => {
    expect(SRC(file)).toMatch(re)
  })
})
