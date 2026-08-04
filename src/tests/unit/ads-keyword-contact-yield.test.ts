/**
 * 📮 **키워드 자동 조율(연락처 수율)** — 2026-08-04 대표 지시 *"저수율 키워드 수집 자동 조율. 영구적으로."*
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제 수율이 올라가는지. 그건 라이브에서만 판정된다
 *   (`run.kw_yield` 로 갱신 여부, 그리고 며칠 뒤 `with_email` 증가분). 여기서 고정하는 건
 *   ① 표본 부족을 벌하지 않음 ② 억제가 **가역**임(탐침 회차) ③ 빈 풀을 만들지 않음
 *   ④ 배선(순환 풀·YT 점수·설정 키·DDL) 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isLowContactYield, suppressLowContactYield, contactPenalty, buildRotationPools,
  maybeRefreshContactYield, CONTACT_EVIDENCE_MIN, CONTACT_OK_RATE, CONTACT_PROBE_EVERY,
  CONTACT_YIELD_CURSOR_KEY,
} from '@/features/marketing/api/keyword-contact-yield'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** 💬 주석 제거 — 배선은 코드에서만 판정한다(주석 처리해도 초록이 뜨던 함정, 이 레포에서 반복됐다). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('판정 — 증거가 없으면 벌하지 않는다', () => {
  it('🔒 표본 부족은 무조건 통과 — 갓 만든 키워드를 0%로 낙인찍으면 탐색이 죽는다', () => {
    expect(isLowContactYield({ measured_total: CONTACT_EVIDENCE_MIN - 1, email_total: 0 })).toBe(false)
    expect(isLowContactYield({})).toBe(false)
    expect(contactPenalty({ measured_total: CONTACT_EVIDENCE_MIN - 1, email_total: 0 })).toBe(0)
  })

  it('🔒 증거가 쌓이면 저수율을 잡는다 (실측: 방배동 맛집 0%/46)', () => {
    expect(isLowContactYield({ measured_total: 46, email_total: 0 })).toBe(true)
    expect(isLowContactYield({ measured_total: 188, email_total: 11 })).toBe(true)   // 금천 맛집 5.9%
  })

  it('🔒 기저(26.7%) 근처는 손대지 않는다 — 임계는 확실히 낮은 선에만', () => {
    expect(isLowContactYield({ measured_total: 200, email_total: 53 })).toBe(false)  // 26.5%
    expect(isLowContactYield({ measured_total: 200, email_total: 31 })).toBe(false)  // 15.5% > OK
    expect(CONTACT_OK_RATE).toBeLessThan(0.267)
  })

  it('🔒 감점은 수율이 낮을수록 커지고, 정상이면 0', () => {
    expect(contactPenalty({ measured_total: 100, email_total: 30 })).toBe(0)
    const zero = contactPenalty({ measured_total: 100, email_total: 0 })
    const half = contactPenalty({ measured_total: 100, email_total: 7 })
    expect(zero).toBeGreaterThan(half)
    expect(half).toBeGreaterThan(0)
  })
})

describe('억제는 가역이어야 한다 — 되돌릴 수 없는 자동화는 사고다', () => {
  const bad = { measured_total: 100, email_total: 2 }
  const good = { measured_total: 100, email_total: 40 }

  it('🔒 보통 회차엔 솎아낸다', () => {
    expect(suppressLowContactYield([bad, good], 1)).toEqual([good])
  })

  it('🔒 탐침 회차엔 전부 통과 — 증거가 갱신돼야 판정이 스스로 뒤집힌다', () => {
    expect(suppressLowContactYield([bad, good], CONTACT_PROBE_EVERY)).toEqual([bad, good])
    expect(suppressLowContactYield([bad, good], CONTACT_PROBE_EVERY * 3)).toEqual([bad, good])
  })

  it('🔒 전부 저조하면 억제하지 않는다 — 빈 풀은 그 축을 통째로 멈춘다', () => {
    expect(suppressLowContactYield([bad, bad], 1)).toEqual([bad, bad])
    expect(suppressLowContactYield([], 1)).toEqual([])
  })
})

describe('3분할 풀 — 배타성과 솎아내기', () => {
  const K = (category: string | null, m = 0, e = 0) => ({ category, measured_total: m, email_total: e })
  const cats = { focus: ['마케팅대행사'], priority: ['맛집', '뷰티'] }

  it('🔒 세 풀은 서로 배타 — 겹치면 같은 키워드가 한 배치에 두 번 들어간다', () => {
    const kws = [K('마케팅대행사'), K('맛집'), K('독서'), K(null)]
    const { focusPool, priPool, genPool } = buildRotationPools(kws, 1, cats)
    expect(focusPool.length + priPool.length + genPool.length).toBe(kws.length)
    expect(focusPool.map(k => k.category)).toEqual(['마케팅대행사'])
    expect(priPool.map(k => k.category)).toEqual(['맛집'])
  })

  it('🔒 저수율은 보통 회차에 빠지고 탐침 회차엔 돌아온다', () => {
    const kws = [K('맛집', 100, 2), K('뷰티', 100, 40)]
    expect(buildRotationPools(kws, 1, cats).priPool).toHaveLength(1)
    expect(buildRotationPools(kws, CONTACT_PROBE_EVERY, cats).priPool).toHaveLength(2)
  })
})

describe('갱신 — 탐침 회차에만, 그리고 조용히 실패하지 않는다', () => {
  const fakeDB = () => ({
    prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), run: async () => ({}) }), all: async () => ({ results: [] }) }),
    batch: async () => [],
  })

  it('🔒 보통 회차엔 아예 안 돈다 — 예산을 매 회차 먹으면 안 된다', async () => {
    expect(await maybeRefreshContactYield(fakeDB(), 1)).toBeUndefined()
    expect(await maybeRefreshContactYield(fakeDB(), CONTACT_PROBE_EVERY - 1)).toBeUndefined()
  })

  it('🔒 탐침 회차엔 돈다', async () => {
    const r = await maybeRefreshContactYield(fakeDB(), CONTACT_PROBE_EVERY)
    expect(r).toBeDefined()
    expect(r!.scanned).toBe(0)
  })

  it('🔒 실패를 삼키지 않는다 — 조용한 0건은 "큐가 빔"과 구분이 안 된다', async () => {
    const boom = { prepare: () => { throw new Error('nope') }, batch: async () => [] }
    const r = await maybeRefreshContactYield(boom as never, CONTACT_PROBE_EVERY)
    expect(r?.error).toBeTruthy()
  })
})

describe('🔌 배선 — 상수만 있고 안 쓰면 무의미하다', () => {
  const COLLECT = read('src/features/marketing/api/influencer-auto-collect.ts')
  const ROT = read('src/features/marketing/api/influencer-keyword-rotation.ts')
  const DDL = read('src/features/marketing/api/influencer-keyword-ddl.ts')

  it('🔒 순환 풀이 실제로 buildRotationPools 를 쓴다', () => {
    expect(code(COLLECT)).toMatch(/const \{ focusPool, priPool, genPool \} = buildRotationPools\(kws, roundIndex,/)
  })

  it('🔒 새 컬럼을 SELECT 한다 — 안 읽으면 판정값이 항상 0이라 아무도 안 걸린다', () => {
    expect(code(COLLECT)).toMatch(/measured_total, email_total FROM ad_discovery_keywords/)
  })

  it('🔒 커서 키가 SETTING_KEYS 에 있다 — 없으면 undefined 로 조용히 0이 된다(#930 클래스)', () => {
    const m = code(COLLECT).match(/const SETTING_KEYS = \[[^\]]*\]/)
    expect(m, 'SETTING_KEYS 선언을 못 찾음').toBeTruthy()
    expect(m![0]).toContain('CONTACT_YIELD_CURSOR_KEY')
  })

  it('🔒 갱신 결과 커서를 저장한다 — 저장 안 하면 같은 슬라이스만 영원히 돈다', () => {
    expect(code(COLLECT)).toMatch(/CONTACT_YIELD_CURSOR_KEY, String\(kwYield\.cursor\)/)
  })

  it('🔒 YT 점수에도 감점이 걸린다', () => {
    expect(code(ROT)).toMatch(/- yieldPenalty\(k\) - contactPenalty\(k\)/)
  })

  it('🔒 DDL 에 컬럼이 있다 — 없으면 SELECT 가 통째로 실패한다', () => {
    // ⚠️ 부분문자열로 보면 안 된다 — `measured_total` 은 `measured_total_x` 에도 매치돼,
    //   컬럼명을 바꾸는 주입에 **초록**이 떴다(주입 검증에서 실제로 걸렸다). 문장 전체로 앵커한다.
    expect(DDL).toMatch(/ADD COLUMN measured_total INTEGER NOT NULL DEFAULT 0/)
    expect(DDL).toMatch(/ADD COLUMN email_total INTEGER NOT NULL DEFAULT 0/)
  })

  it('🔒 import 는 파일 상단에만 — 중간 import 는 이 레포에서 worker 크래시를 냈다(2026-04-22)', () => {
    const lines = ROT.split('\n')
    const firstNonImport = lines.findIndex((l, i) => i > 0 && /^(export )?(const|function|interface|type) /.test(l))
    const lastImport = lines.map((l, i) => (/^import /.test(l) ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    expect(lastImport).toBeLessThan(firstNonImport)
  })

  it('🔒 커서 키 문자열이 갈라지지 않는다', () => {
    expect(CONTACT_YIELD_CURSOR_KEY).toBe('ads_kw_contact_yield_cursor')
  })
})
