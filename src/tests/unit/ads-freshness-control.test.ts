import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  planFreshnessCap, parseFreshnessCap, decideFreshness,
  FRESHNESS_CAP_KEY, FRESHNESS_CAP_MIN, FRESHNESS_CAP_MAX, FRESHNESS_CAP_STEP, FRESHNESS_MIN_ROUNDS,
} from '@/features/marketing/api/influencer-freshness-control'
import { AUTO_RETIRE_WHERE, PROMOTE_NOT_RETIRABLE_SQL } from '@/features/marketing/api/influencer-keyword-rotation'

const COLLECT = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
/** 주석을 걷어낸 본문 — 가드는 코드를 읽어야 한다(주석에만 남아도 통과하는 함정 회피). */
const CODE = COLLECT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const STORE = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-keyword-store.ts'), 'utf8')

/** 하락 이력(앞 절반 높고 뒤 절반 낮음) — 라이브 실측 형상(키워드당 74 → 33). */
const DECLINING = [
  { processed: 9, saved: 666 }, { processed: 9, saved: 650 }, { processed: 9, saved: 640 }, { processed: 9, saved: 630 },
  { processed: 9, saved: 300 }, { processed: 9, saved: 290 }, { processed: 9, saved: 295 }, { processed: 9, saved: 280 },
]
/** 안정 이력 — 앞뒤가 같다. */
const STABLE = Array.from({ length: 10 }, () => ({ processed: 9, saved: 450 }))

describe('신선도 자동 조율 — 발굴량이 떨어지면 스스로 넓힌다', () => {
  it('📉 수확이 하락하면 캡을 넓힌다 (이 모듈의 존재 이유)', () => {
    const v = planFreshnessCap({ recent: DECLINING, cap: 120, autoActive: 120, blocked: 0 })
    expect(v.reason).toBe('yield-declining')
    expect(v.cap).toBe(120 + FRESHNESS_CAP_STEP)
    expect(v.yieldAfter).toBeLessThan(v.yieldBefore) // 판단 근거를 밖에서 볼 수 있어야 한다
  })

  it('🟢 안정적이면 그대로 둔다 — 좋아졌다고 되돌리지 않는다(대표 "줄어들면 안 돼")', () => {
    const v = planFreshnessCap({ recent: STABLE, cap: 200, autoActive: 200, blocked: 0 })
    expect(v.reason).toBe('stable')
    expect(v.cap).toBe(200)
  })

  /**
   * 🚨 **가장 중요한 안전장치** — 확장이 차단을 부르면 발굴 전체가 멎는다. 어떤 수확 이득보다 크다.
   *   차단은 되돌리기 어렵고(평판·IP), 그래서 하락 중이어도 확장하지 않는다.
   */
  it('🚨 네이버 차단이 있으면 하락 중이어도 동결한다', () => {
    const v = planFreshnessCap({ recent: DECLINING, cap: 120, autoActive: 120, blocked: 3 })
    expect(v.reason).toBe('blocked-freeze')
    expect(v.cap).toBe(120)
  })

  it('🪑 자리가 남아 있으면 확장하지 않는다 — 캡이 병목이 아니다', () => {
    // 하락 중이지만 auto 가 캡보다 적다 = 못 채우는 이유가 캡이 아니라 후보 부족.
    const v = planFreshnessCap({ recent: DECLINING, cap: 200, autoActive: 150, blocked: 0 })
    expect(v.reason).toBe('room-available')
    expect(v.cap).toBe(200)
  })

  /**
   * ⚠️ 이 레포의 상습 오진("좁은 창으로 단정")을 **코드로** 막는다 — 30시간만 보고 포화라 했다가
   *   3주 보니 17배 진폭이었던 일이 있다. 표본이 모자라면 아무것도 하지 않는다.
   */
  it('🔬 회차 표본이 모자라면 아무것도 하지 않는다', () => {
    const few = DECLINING.slice(0, FRESHNESS_MIN_ROUNDS - 1)
    const v = planFreshnessCap({ recent: few, cap: 120, autoActive: 120, blocked: 0 })
    expect(v.reason).toBe('insufficient-evidence')
    expect(v.cap).toBe(120)
  })

  it('🧱 상한에 닿으면 사람 판단으로 넘긴다(무한 확장 없음)', () => {
    const v = planFreshnessCap({ recent: DECLINING, cap: FRESHNESS_CAP_MAX, autoActive: FRESHNESS_CAP_MAX, blocked: 0 })
    expect(v.reason).toBe('at-ceiling')
    expect(v.cap).toBe(FRESHNESS_CAP_MAX)
  })

  /**
   * 🔒 **아래로 안 내려간다** — 대표 지시 "줄어들면 안 돼"의 코드적 표현. 조율기가 고장 나거나
   *   저장값이 손상돼도 발굴이 지금보다 나빠지지 않는 쪽으로 실패해야 한다.
   */
  it('🔒 손상·이상값에도 하한 밑으로 내려가지 않는다', () => {
    for (const bad of ['', null, undefined, 'abc', '0', '-50', '9999']) {
      const c = parseFreshnessCap(bad as string | null | undefined)
      expect(c).toBeGreaterThanOrEqual(FRESHNESS_CAP_MIN)
      expect(c).toBeLessThanOrEqual(FRESHNESS_CAP_MAX)
    }
    for (const cap of [-10, 0, Number.NaN, 5]) {
      const v = planFreshnessCap({ recent: STABLE, cap, autoActive: 999, blocked: 0 })
      expect(v.cap).toBeGreaterThanOrEqual(FRESHNESS_CAP_MIN)
    }
  })

  it('📈 여러 회차를 거치면 계단식으로 오른다(한 번에 폭주하지 않는다)', () => {
    let cap = FRESHNESS_CAP_MIN
    const seen: number[] = []
    for (let i = 0; i < 5; i++) {
      const v = planFreshnessCap({ recent: DECLINING, cap, autoActive: cap, blocked: 0 })
      expect(v.cap - cap).toBeLessThanOrEqual(FRESHNESS_CAP_STEP) // 한 회차 증분 상한
      cap = v.cap; seen.push(cap)
    }
    expect(seen[seen.length - 1]).toBeGreaterThan(FRESHNESS_CAP_MIN)
    expect(cap).toBeLessThanOrEqual(FRESHNESS_CAP_MAX)
  })

  it('🔌 어댑터가 설정에서 차단·캡을 실제로 읽는다', () => {
    const withBlock = decideFreshness({ [FRESHNESS_CAP_KEY]: '140', ads_naver_crawl_block: '{"blocked":2}' }, DECLINING, 140)
    expect(withBlock.stamp.reason).toBe('blocked-freeze')
    expect(withBlock.cap).toBe(140)
    const clean = decideFreshness({ [FRESHNESS_CAP_KEY]: '140', ads_naver_crawl_block: '{"blocked":0}' }, DECLINING, 140)
    expect(clean.cap).toBe(160)
    expect(clean.stamp.prev_cap).toBe(140)
    // 손상된 JSON 은 차단 0 으로(경보가 아니라 조용한 진행 — 파싱 실패가 발굴을 멈추면 안 된다)
    expect(decideFreshness({ ads_naver_crawl_block: 'not-json' }, DECLINING, 999).stamp.reason).not.toBe('blocked-freeze')
  })

  /**
   * 🔌 **배선 가드** — 순수함수가 옳아도 호출부가 캡을 읽거나 저장하지 않으면 조율기는
   *   "계산만 하고 아무 일도 안 하는" 장식이 된다(#930 집중 커서와 같은 실패 모드).
   */
  it('🔌 수집 루프가 캡을 읽기·전달·저장 전부 한다', () => {
    expect(CODE, 'SETTING_KEYS 에 캡 키가 없으면 읽기가 항상 undefined').toContain('FRESHNESS_CAP_KEY')
    expect(CODE, '캡을 승격에 넘기지 않으면 종전 상수가 그대로 쓰인다')
      .toMatch(/promoteHashtagKeywords\(DB, hashtagFreq, freshCap\)/)
    expect(CODE, '조율기를 부르지 않으면 캡이 영구 고정').toMatch(/decideFreshness\(settings,/)
    expect(CODE, '마감 batch 에 저장하지 않으면 다음 회차가 옛 캡을 읽는다')
      .toMatch(/\[FRESHNESS_CAP_KEY,\s*String\(fresh\.cap\)\]/)
    expect(CODE, '차단 키를 안 읽으면 안전장치가 항상 0 으로 통과').toContain("'ads_naver_crawl_block'")
  })
})

describe('은퇴 — "다 훑은" 키워드가 자리를 비켜야 신선도가 들어온다', () => {
  it('🍂 exhausted 조각이 "요즘"을 본다 — 누적만 보면 광맥을 다 캔 자리가 영원히 앉아 있다', () => {
    expect(AUTO_RETIRE_WHERE.exhausted).toMatch(/COALESCE\(last_saved, 0\) <= 2/)
    expect(AUTO_RETIRE_WHERE.exhausted).toMatch(/COALESCE\(saved_total, 0\) >= 100/)
  })

  /**
   * ⚠️ **livelock 회귀 가드** — 은퇴 조각이 승격 차단에 없으면 은퇴자가 그 회차에 재승격되고
   *   다음 회차 시작에 즉시 재은퇴된다(2026-08-09 실사고). 새 조각도 반드시 포함돼야 한다.
   */
  it('🧟 승격 차단이 exhausted 를 포함한다(재승격→즉시재은퇴 livelock 방지)', () => {
    for (const frag of [AUTO_RETIRE_WHERE.f30, AUTO_RETIRE_WHERE.barren, AUTO_RETIRE_WHERE.yield, AUTO_RETIRE_WHERE.exhausted]) {
      expect(PROMOTE_NOT_RETIRABLE_SQL).toContain(frag)
    }
  })

  /**
   * ⚠️ **영구 배제 금지**(2026-08-09 대표 "영구 배제가 되면 안되는데?") — 증거 유통기한이 가석방을
   *   만든다. 은퇴한 행은 안 돌아 `last_run_at` 이 늙고, 30일 뒤 조각에서 빠져 승격 차단도 풀린다.
   */
  it('🕊️ exhausted 에도 증거 유통기한(가석방)이 있다', () => {
    expect(AUTO_RETIRE_WHERE.exhausted).toMatch(/last_run_at >= datetime\('now','-30 days'\)/)
  })

  it('🔒 은퇴문은 auto 전용 + 회차당 상한 — seed(대표가 고른 축)는 무접촉', () => {
    const stmts = STORE.match(/UPDATE ad_discovery_keywords SET active = 0[^`]+/g) || []
    expect(stmts.length).toBeGreaterThanOrEqual(4) // f30 · barren · yield · exhausted
    for (const st of stmts) expect(st, st.slice(0, 60)).toContain("source = 'auto'")
    // 다 훑음 문은 한꺼번에 비우지 않는다(승격 물결이 몰려 요동하는 것 방지).
    const ex = stmts.find(st => st.includes('where.exhausted'))
    expect(ex, 'exhausted 은퇴문이 배선돼 있어야 한다').toBeTruthy()
    expect(ex).toContain('LIMIT 3')
  })
})
