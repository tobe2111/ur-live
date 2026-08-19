import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  planSearchDepth, normalizeStart, lastValidStart,
  NAVER_SEARCH_MAX_START, NAVER_SEARCH_DISPLAY,
} from '@/features/marketing/api/influencer-search-depth'

const DISCOVERY = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-discovery.ts'), 'utf8')
const COLLECT = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')

/**
 * 📖 **검색 깊이 커서** (2026-08-19 대표 *"왜 줄어드는지 원인을 파악하고 해결해줘 영구적으로"*).
 *
 *   진단: 회차당 네이버 found 는 555~793 으로 **안 줄었는데** 신규율만 8.4%~38.6% 로 무너졌다.
 *   원인은 검색 URL 에 `start` 가 없어 **매번 같은 상위 100건**만 본 것. 1,000건이 열려 있었다.
 *
 *   ⚠️ 이 파일이 못 막는 것: 네이버가 실제로 `start` 를 존중하는지는 **라이브에서만** 확인된다
 *      (이 환경은 네이버 자격증명이 없다). 배포 후 신규율로 판정할 것 — 그 판정 절차는 handoff.
 */
describe('검색 깊이 커서 — 같은 페이지를 반복해서 긁지 않는다', () => {
  it('🕐 최신순(date)은 항상 1페이지 — 새 글이 올라오는 창을 깊이 파면 안 된다', () => {
    for (const c of [1, 101, 901, 5000, null, undefined, 'x']) {
      const p = planSearchDepth('date', c as unknown)
      expect(p.start, `cursor=${String(c)}`).toBe(1)
      expect(p.wrapped).toBe(false)
    }
    // 커서는 **보존**된다 — date 회차가 sim 의 진행을 되돌리면 깊이가 영원히 안 는다.
    expect(planSearchDepth('date', 301).nextStart).toBe(301)
  })

  it('📖 정확도순(sim)은 회차마다 100씩 밀어 새 페이지를 본다', () => {
    expect(planSearchDepth('sim', 1)).toEqual({ start: 1, nextStart: 101, wrapped: false })
    expect(planSearchDepth('sim', 101)).toEqual({ start: 101, nextStart: 201, wrapped: false })
    expect(planSearchDepth('sim', 801)).toEqual({ start: 801, nextStart: 901, wrapped: false })
  })

  it('🔁 마지막 페이지에서 1로 되감고 그 사실을 알린다(그때가 진짜 고갈 신호)', () => {
    const p = planSearchDepth('sim', 901)
    expect(p.start).toBe(901)
    expect(p.nextStart).toBe(1)
    expect(p.wrapped).toBe(true)
  })

  it('🚧 API 상한을 절대 넘지 않는다 — start + display - 1 <= 1000', () => {
    expect(lastValidStart()).toBe(NAVER_SEARCH_MAX_START - NAVER_SEARCH_DISPLAY + 1)
    // 한 바퀴 전부 순회해도 상한 밖으로 못 나간다(넘기면 네이버가 400 을 준다).
    let c = 1
    for (let i = 0; i < 50; i++) {
      const p = planSearchDepth('sim', c)
      expect(p.start).toBeGreaterThanOrEqual(1)
      expect(p.start + NAVER_SEARCH_DISPLAY - 1).toBeLessThanOrEqual(NAVER_SEARCH_MAX_START)
      c = p.nextStart
    }
  })

  it('🛟 손상된 커서는 수집을 멎게 하지 않는다 — 1페이지로 실패한다', () => {
    for (const bad of [null, undefined, 0, -5, NaN, 'abc', 99999, 1e9]) {
      expect(normalizeStart(bad as unknown), String(bad)).toBe(1)
    }
  })

  it('📐 한 바퀴는 10페이지 = 1,000건 — 지금 보던 것의 10배', () => {
    const seen: number[] = []
    let c = 1
    do { const p = planSearchDepth('sim', c); seen.push(p.start); c = p.nextStart } while (c !== 1)
    expect(seen).toEqual([1, 101, 201, 301, 401, 501, 601, 701, 801, 901])
  })

  /**
   * 🔌 **배선 불변식** — 순수 함수가 맞아도 호출부가 안 쓰면 아무 일도 안 일어난다.
   *   이 레포의 상습 사고("계산해 놓고 안 쓰는 계측")를 여기서 막는다.
   *   ⚠️ 못 막는 것: 네이버가 실제로 다른 결과를 주는지(= 효과)는 라이브 신규율로만 판정된다.
   */
  it('🔌 검색 URL 이 start 를 싣고, 수집 루프가 커서를 넘기고 저장한다', () => {
    expect(DISCOVERY, '검색 URL 에 start 가 없으면 이 수정 전체가 무의미하다').toMatch(/start=\$\{[^}]*start[^}]*\}/)
    expect(DISCOVERY, 'start 는 planSearchDepth 가 정한 값이어야 한다(두 벌 계산 금지)').toMatch(/planSearchDepth/)
    expect(COLLECT, '수집 루프가 키워드별 커서를 넘겨야 한다').toMatch(/nb_start/)
    expect(COLLECT, '다음 커서를 저장 안 하면 영원히 1페이지에 머문다').toMatch(/nb_start\s*=/)
  })
})
