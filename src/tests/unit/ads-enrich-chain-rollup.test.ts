/**
 * 🔗 체인 합산 — "라운드 하나가 아니라 **이 정각에 실제로 일어난 일**"을 본다.
 *
 * ## 왜 (오늘 세 번 오독한 그 창)
 * 보강 레인은 정각마다 self-chain 으로 라운드 N개를 돈다. 그런데 스냅샷은 **마지막 라운드만** 남긴다.
 * 2026-07-29 실측이 `depth: 2 · naver { selected: 12, tried: 0 }` 였는데, 이건 "블로거를 한 명도 못 쟀다"가
 * 아니라 **"마지막 라운드가 못 쟀다"** 일 뿐이다 — 앞 두 라운드가 뭘 했는지 볼 방법이 아예 없었다.
 * 그 한 장으로 #880(블로거 시간 바닥) 판정을 세 번 했고, 한 번은 그 오독으로 단계 순서를 뒤집는
 * 커밋까지 썼다가 되돌렸다. 그래서 합계를 만든다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 라운드가 스냅샷을 쓰기 전에 죽으면 애초에 안 세어진다. 그건 값으로
 *    못 고치는 종류라 `rounds` vs `max_depth` 의 **불일치를 신호로 남기는 것**까지만 한다(아래 케이스).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rollupChain, type EnrichChainRollup } from '@/features/marketing/api/influencer-enrich-lane'
import type { NaverEnrichDiag } from '@/features/marketing/api/influencer-performance'

const nv = (o: Partial<NaverEnrichDiag> = {}): NaverEnrichDiag =>
  ({ tried: 0, measured: 0, contacts: 0, failed: 0, ...o })

const round = (o: Partial<{ bio: number; yt: number; naver: NaverEnrichDiag; spent: number; deadlineHit: boolean; at: string }> = {}) =>
  ({ bio: 0, yt: 0, naver: nv(), spent: 0, deadlineHit: false, at: '2026-07-29 14:00:10', ...o })

describe('rollupChain — 정각 하나의 합', () => {
  it('depth 0 은 새 체인이다 — 지난 회차를 이어 붙이지 않는다', () => {
    // 이어 붙이면 "이번 정각에 무슨 일이 있었나"를 다시 못 본다 = 이 값을 만든 이유가 사라진다.
    const prev: EnrichChainRollup = {
      rounds: 3, max_depth: 2, bio: 1, yt: 40, naver_selected: 30, naver_tried: 30,
      naver_measured: 28, naver_contacts: 5, deadline_hits: 3, spent: 120, started_at: '2026-07-29 13:00:10',
    }
    const r = rollupChain(prev, 0, round({ yt: 14, at: '2026-07-29 14:00:10' }))
    expect(r.rounds).toBe(1)
    expect(r.yt).toBe(14)
    expect(r.naver_measured).toBe(0)
    expect(r.started_at).toBe('2026-07-29 14:00:10')
  })

  it('depth > 0 은 앞 라운드에 더한다 — 이게 합계의 전부다', () => {
    let c = rollupChain(undefined, 0, round({ yt: 14, naver: nv({ selected: 12, tried: 0 }), spent: 19, deadlineHit: true }))
    c = rollupChain(c, 1, round({ yt: 0, naver: nv({ selected: 12, tried: 12, measured: 11, contacts: 2 }), spent: 26 }))
    c = rollupChain(c, 2, round({ yt: 0, naver: nv({ selected: 12, tried: 9, measured: 9, contacts: 1 }), spent: 20, deadlineHit: true }))
    expect(c.rounds).toBe(3)
    expect(c.max_depth).toBe(2)
    expect(c.naver_measured).toBe(20)     // 마지막 한 장만 보면 9 로 보인다
    expect(c.naver_tried).toBe(21)
    expect(c.naver_contacts).toBe(3)
    expect(c.deadline_hits).toBe(2)
    expect(c.spent).toBe(65)
    expect(c.started_at).toBe('2026-07-29 14:00:10')
  })

  it('🔒 실측 재현: 마지막 라운드가 0 이어도 그 회차가 0 인 것은 아니다', () => {
    // 07-29 13:00 스냅샷이 정확히 이 모양이었다(`depth 2 · tried 0`). 합계가 있으면 오독이 불가능해진다.
    let c = rollupChain(undefined, 0, round({ naver: nv({ selected: 13, tried: 13, measured: 12 }) }))
    c = rollupChain(c, 1, round({ naver: nv({ selected: 13, tried: 7, measured: 7 }) }))
    c = rollupChain(c, 2, round({ naver: nv({ selected: 12, tried: 0 }), deadlineHit: true }))
    expect(c.naver_measured).toBe(19)
    expect(c.naver_selected - c.naver_tried).toBe(18)  // 고르고도 못 잰 수 = 시간에 잘린 양
  })

  it('중간 라운드가 죽으면 rounds < max_depth+1 로 드러난다 — 합계 0 을 "못 쟀다"로 읽지 않게', () => {
    let c = rollupChain(undefined, 0, round({ naver: nv({ tried: 5, measured: 5 }) }))
    c = rollupChain(c, 3, round({ naver: nv({ tried: 1, measured: 1 }) }))   // depth 1·2 는 기록 없음
    expect(c.rounds).toBe(2)
    expect(c.max_depth).toBe(3)
    expect(c.rounds).toBeLessThan(c.max_depth + 1)
  })

  it('prev 없음 / 손상값에 throw 하지 않는다 — 첫 배포와 옛 스냅샷을 견딘다', () => {
    expect(rollupChain(undefined, 2, round({ yt: 3 })).rounds).toBe(1)
    const broken = { rounds: NaN, yt: undefined } as unknown as EnrichChainRollup
    const c = rollupChain(broken, 1, round({ yt: 3 }))
    expect(c.rounds).toBe(1)
    expect(c.yt).toBe(3)
    expect(Number.isFinite(c.naver_measured)).toBe(true)
  })

  it('음수 depth·비정상 depth 는 0(새 체인)으로 본다', () => {
    const prev = rollupChain(undefined, 0, round({ yt: 5 }))
    expect(rollupChain(prev, -1, round({ yt: 1 })).rounds).toBe(1)
    expect(rollupChain(prev, NaN, round({ yt: 1 })).rounds).toBe(1)
  })
})

/**
 * 🚧 배선 — 서버가 합산해도 **화면이 안 읽으면 없는 것과 같다**(이 레포의 반복 실패 클래스).
 */
describe('배선 — 합계가 스냅샷에 실리고 화면이 읽는가', () => {
  it('레인이 매 라운드 chain 을 스냅샷에 쓴다', () => {
    const src = readFileSync('src/features/marketing/api/influencer-enrich-lane.ts', 'utf8')
    // 순수함수만 만들고 호출을 안 하면 **에러 없이** 필드가 영원히 안 생긴다.
    expect(src).toMatch(/chain:\s*rollupChain\(/)
  })
  it('어드민 화면이 chain 을 실제로 렌더한다', () => {
    const ui = readFileSync('src/pages/admin/influencer-pool/CollectDiagPanel.tsx', 'utf8')
    for (const k of ['rounds', 'naver_measured', 'naver_tried', 'naver_selected', 'max_depth']) {
      // 경계까지 본다 — `naver_tried_typo` 도 포함하는 느슨한 매칭은 가드가 아니라 초록불 기계다.
      expect(ui).toMatch(new RegExp(`enrichLane\\??\\.chain\\??\\.${k}\\b(?!_)`))
    }
  })
})
