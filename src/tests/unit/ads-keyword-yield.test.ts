/**
 * 🌾 수확률 페널티 — `barren_streak` 의 사각지대를 메운다 (2026-07-29 라이브 실측 기반).
 *
 * `barren_streak` 은 **`found == 0`**(아무도 못 찾음) 회차만 센다. 그래서 "많이 찾았는데 한 명도
 * 안 남는" 키워드는 streak 가 영원히 0 이고 고갈 판정에 안 걸린다. 라이브에서 정확히 그 상태였다:
 *
 * ```
 *   active=1 · barren_streak=0
 *   [숙소] 한옥스테이 found=117 saved=0 · [맛집] 부산 맛집 found=123 saved=0
 *   [숙소] 펜션 추천  found=119 saved=0 · [맛집] 로컬 맛집 found=105 saved=0
 *   → 검색 464건, 리드 0명
 * ```
 * 넷 다 `PRIORITY_CATEGORIES` 라 점수 **+50** 을 받는다 — 아무것도 못 내면서 하루 100회뿐인
 * YT 검색 슬롯에서 *우대*받고 있었다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: `saved 0` 의 원인이 '나쁜 키워드'인지 '이미 다 모았음(고갈)'인지.
 *    데이터로 구분 불가라서 처방을 **배제가 아니라 감점**으로 잡았다 — 그 선택이 맞는지는
 *    라이브에서 이 키워드들이 되살아나는지로만 확인된다(수확이 생기면 점수가 회복되어야 한다).
 */
import { describe, it, expect } from 'vitest'
import {
  yieldPenalty, pickYtKeywords, PRIORITY_CATEGORIES,
  YIELD_EVIDENCE_MIN, YIELD_OK_RATE, YIELD_PENALTY_MAX,
  type YtPickKeyword,
} from '@/features/marketing/api/influencer-keyword-rotation'

const HOUR = 3600_000
const NOW = Date.parse('2026-07-29T12:00:00Z')
/** 쿨다운을 확실히 지난 시각(기본 6h + barren 가산 여유). */
const longAgo = new Date(NOW - 30 * 24 * HOUR).toISOString().replace('T', ' ').slice(0, 19)

const kw = (o: Partial<YtPickKeyword> & { id: number }): YtPickKeyword => ({
  keyword: `k${o.id}`, category: null, last_run_at: longAgo, ...o,
})

describe('yieldPenalty — 증거가 쌓인 뒤에만 벌준다', () => {
  it('증거 부족(신규 키워드)은 무조건 0 — 탐색을 죽이지 않는다', () => {
    expect(yieldPenalty(kw({ id: 1, found_total: YIELD_EVIDENCE_MIN - 1, saved_total: 0 }))).toBe(0)
    expect(yieldPenalty(kw({ id: 2 }))).toBe(0)                                  // found_total 없음
    expect(yieldPenalty(kw({ id: 3, found_total: 0, saved_total: 0 }))).toBe(0)
  })
  it('수확률이 기준 이상이면 0 — 잘 되는 키워드는 안 건드린다', () => {
    const found = 200
    expect(yieldPenalty(kw({ id: 4, found_total: found, saved_total: found * YIELD_OK_RATE }))).toBe(0)
    expect(yieldPenalty(kw({ id: 5, found_total: found, saved_total: found * 0.9 }))).toBe(0)
  })
  it('0% 는 최대 감점 — 우선 카테고리 보너스(+50)를 상쇄하고 남아야 한다', () => {
    expect(yieldPenalty(kw({ id: 6, found_total: 117, saved_total: 0 }))).toBe(YIELD_PENALTY_MAX)
    expect(YIELD_PENALTY_MAX).toBeGreaterThan(50)
  })
  it('나쁠수록 크게, 좋아질수록 작게 — 계단이 아니라 기울기다', () => {
    const p = (saved: number) => yieldPenalty(kw({ id: 7, found_total: 100, saved_total: saved }))
    expect(p(0)).toBeGreaterThan(p(2))
    expect(p(2)).toBeGreaterThan(p(5))
    expect(p(5)).toBeGreaterThan(p(9))
    expect(p(10)).toBe(0)
  })
  it('음수·이상값에 throw 하지 않는다', () => {
    expect(yieldPenalty(kw({ id: 8, found_total: -5, saved_total: -5 }))).toBe(0)
    expect(yieldPenalty(kw({ id: 9, found_total: 100, saved_total: 999 }))).toBe(0)
  })
})

describe('pickYtKeywords — 실측 사례가 실제로 뒤로 밀리는가', () => {
  it('🔒 라이브 재현: 우선 카테고리 0% 키워드가 무성과 신규 키워드보다 뒤로 간다', () => {
    // 이게 이 변경의 전부다. 감점이 없으면 '한옥스테이'(+50)가 신규(0)를 이겨 슬롯을 계속 먹는다.
    const barren = kw({ id: 1, keyword: '한옥스테이', category: '숙소', found_total: 117, saved_total: 0 })
    const fresh = kw({ id: 2, keyword: '신규키워드', category: null, found_total: 3, saved_total: 0 })
    const picks = pickYtKeywords([barren, fresh], 2, NOW)
    expect(picks.map(k => k.keyword)).toEqual(['신규키워드', '한옥스테이'])
  })
  it('생산적인 우선 키워드는 여전히 1순위 — 감점이 좋은 것까지 밀어내지 않는다', () => {
    const good = kw({ id: 1, keyword: '강서 네일', category: '네일', found_total: 90, saved_total: 81, last_saved: 5 })
    const barren = kw({ id: 2, keyword: '부산 맛집', category: '맛집', found_total: 123, saved_total: 0 })
    expect(pickYtKeywords([barren, good], 1, NOW)[0].keyword).toBe('강서 네일')
  })
  it('감점은 배제가 아니다 — 남은 후보가 그것뿐이면 여전히 뽑힌다(고갈은 되살아날 수 있다)', () => {
    const barren = kw({ id: 1, keyword: '펜션 추천', category: '숙소', found_total: 119, saved_total: 0 })
    expect(pickYtKeywords([barren], 1, NOW).map(k => k.keyword)).toEqual(['펜션 추천'])
  })
  it('한 명이라도 건지면 회복한다 — last_saved 가 감점을 넘어선다', () => {
    const recovered = kw({ id: 1, keyword: '로컬 맛집', category: '맛집', found_total: 105, saved_total: 4, last_saved: 4 })
    const plain = kw({ id: 2, keyword: '평범', category: null, found_total: 3, saved_total: 0 })
    // last_saved*3(12) + saved(4) + 우선(50) − 감점 ≈ 여전히 상위. '영구 사망' 이 아님을 고정한다.
    expect(pickYtKeywords([plain, recovered], 1, NOW)[0].keyword).toBe('로컬 맛집')
  })
  it('우선 카테고리 목록이 비어도 동작한다(호출부가 다른 목록을 줄 수 있다)', () => {
    const a = kw({ id: 1, category: '숙소', found_total: 100, saved_total: 0 })
    const b = kw({ id: 2, category: '숙소', found_total: 100, saved_total: 50 })
    expect(pickYtKeywords([a, b], 1, NOW, [])[0].id).toBe(2)
    expect(PRIORITY_CATEGORIES).toContain('숙소')
  })
})

describe('🚧 배선 — 점수 함수가 found_total 을 실제로 받는가', () => {
  it('키워드 조회 SELECT 에 found_total 이 있다 — 없으면 감점이 영원히 0 이다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')
    // 순수함수만 고치고 SELECT 를 안 고치면 undefined 가 들어와 **조용히 아무 일도 안 일어난다**.
    // 이 레포가 반복해 만난 '고쳤는데 안 도는' 형태라 배선 자체를 고정한다.
    const sel = /SELECT[^']*FROM ad_discovery_keywords WHERE active = 1/.exec(src)?.[0] || ''
    expect(sel).toContain('found_total')
    expect(sel).toContain('saved_total')
  })
})
