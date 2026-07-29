/**
 * 🧭 탐색 순번 — **대표가 지정한 축이 기계가 만든 해시태그 뒤에 서지 않게**.
 *
 * ## 라이브 실측 (2026-07-29) — 이 테스트가 존재하는 이유
 * 대표가 "공동구매 카테고리 인플루언서 DB를 확보하라"고 지시했고, 그 축은 이미 다 갖춰져 있었다:
 * 분류 규칙(`RULES` 최상단) · 우선 카테고리(+50) · **키워드 42개가 `active=1` 로 시드됨**.
 * 그런데 실측하니 **42개 중 41개가 `last_run_at = NULL`** — 한 번도 검색된 적이 없었다.
 *
 * ```
 *   미실행 키워드 703 · 그중 자동확장(해시태그) 557
 *   공동구매(오늘 07:00 seed) → 미실행 큐 582~622위
 *   탐색 슬롯 라운드당 1개 · 오늘 실행된 키워드 30개  ⇒ 첫 차례까지 ≈ 75일
 * ```
 *
 * 원인은 우선순위 *값*이 아니라 **줄 세우는 기준의 부재**였다. `PRIORITY_CATEGORIES`(+50)는
 * 이미 돌아본 키워드의 점수에만 쓰이고, 미실행 큐는 `sort(a.id - b.id)` = 들어온 순서였다.
 * 새 전략 축은 정의상 **가장 늦게 들어오므로 항상 맨 뒤**가 된다 — 축을 추가할 때마다 재발하는 구조다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 탐색 슬롯 수(라운드당 1)는 그대로다. 41개를 다 도는 데는
 *    여전히 41라운드가 걸린다. 여기서 고정하는 건 "누가 먼저 서는가"뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { pickYtKeywords, exploreRank, PRIORITY_CATEGORIES, type YtPickKeyword } from '@/features/marketing/api/influencer-keyword-rotation'

const NOW = Date.parse('2026-07-29T15:00:00Z')
const kw = (o: Partial<YtPickKeyword> & { id: number }): YtPickKeyword =>
  ({ keyword: `k${o.id}`, category: null, last_run_at: null, ...o })

describe('exploreRank — 사람이 고른 것 먼저', () => {
  it('자동확장(auto)보다 시드/수동이 앞선다', () => {
    expect(exploreRank(kw({ id: 1, source: 'seed' }))).toBeLessThan(exploreRank(kw({ id: 2, source: 'auto' })))
    expect(exploreRank(kw({ id: 3, source: 'manual' }))).toBeLessThan(exploreRank(kw({ id: 4, source: 'auto' })))
  })
  it('같은 등급이면 우선 카테고리가 앞선다', () => {
    const prio = kw({ id: 1, source: 'seed', category: '공동구매' })
    const plain = kw({ id: 2, source: 'seed', category: '취미' })
    expect(exploreRank(prio)).toBeLessThan(exploreRank(plain))
  })
  it('source 미상은 사람 것으로 본다 — 옛 행을 자동확장으로 강등하지 않는다', () => {
    expect(exploreRank(kw({ id: 1 }))).toBe(exploreRank(kw({ id: 2, source: 'seed' })))
  })
  it('공동구매가 우선 카테고리에 실제로 들어 있다 — 아니면 위 규칙이 무의미하다', () => {
    expect(PRIORITY_CATEGORIES).toContain('공동구매')
  })
})

describe('pickYtKeywords — 🔒 라이브 재현: 해시태그 557개 뒤에 선 공동구매', () => {
  /** 실측 구조를 축소 재현: 자동확장이 먼저 들어오고(id 작음), 대표 시드가 나중에 들어온다(id 큼). */
  const auto = Array.from({ length: 50 }, (_, i) => kw({ id: 1000 + i, source: 'auto', category: '자동' }))
  const gb = Array.from({ length: 5 }, (_, i) => kw({ id: 54736 + i, source: 'seed', category: '공동구매' }))

  it('탐색 슬롯이 자동확장이 아니라 대표 시드로 간다', () => {
    const picks = pickYtKeywords([...auto, ...gb], 1, NOW)
    expect(picks).toHaveLength(1)
    expect(picks[0].category).toBe('공동구매')
    // 수리 전에는 id 최소값(자동확장 1000번)이 뽑혔다 — 그게 75일 지연의 실체다.
    expect(picks[0].id).toBe(54736)
  })

  it('시드끼리는 들어온 순서를 지킨다 — 순번이 무작위가 되면 커버리지에 구멍이 난다', () => {
    const picks = pickYtKeywords(gb.slice().reverse(), 5, NOW)
    expect(picks.map(k => k.id)).toEqual([54736, 54737, 54738, 54739, 54740])
  })

  it('시드가 다 돌면 자동확장도 결국 돈다 — 굶기는 게 아니라 순서다', () => {
    const picks = pickYtKeywords([...auto, ...gb], 8, NOW)
    expect(picks.slice(0, 5).every(k => k.category === '공동구매')).toBe(true)
    expect(picks.slice(5).every(k => k.category === '자동')).toBe(true)
  })

  it('성과가 검증된 키워드의 슬롯을 뺏지 않는다 — 탐색은 여전히 1자리', () => {
    // 이미 돌아 수확이 있는 키워드(쿨다운 지남)는 점수순으로 나머지 자리를 채운다.
    const proven = kw({
      id: 5, keyword: '동네 맛집', category: '맛집', source: 'seed',
      last_run_at: '2026-07-28 09:00:00', saved_total: 1179, last_saved: 94, found_total: 2072,
    })
    const picks = pickYtKeywords([proven, ...auto, ...gb], 2, NOW)
    expect(picks.map(k => k.keyword)).toContain('동네 맛집')
    expect(picks.filter(k => !k.last_run_at)).toHaveLength(1)   // 탐색은 1자리 그대로
  })
})
