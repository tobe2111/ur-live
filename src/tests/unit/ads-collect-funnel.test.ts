/**
 * 📈 **회차 퍼널 시계열** — 대표 승인 "3번"(2026-08-11, *"관측부터"*).
 *
 * ## 왜 이 테스트가 존재하나
 * 대표가 *"발굴량이 줄어들면 안 돼"* 라고 했고 실제로 4일 연속 하락이 있었는데, 원인을 재려니
 * **회차 기록이 마지막 1회분만 남아 있었다**(수집 blob 은 매 회차 덮어써진다). 같은 날 두 회차의
 * 네이버 수확률이 `458→50(10.9%)` 와 `538→317(58.9%)` 로 **6배** 흔들리는데 그 분포를 볼 수 없었다.
 * ⇒ 이 시계열이 없으면 다음 세션도 똑같이 추측으로 처방하게 된다.
 *
 * ## ⚠️ 이 테스트가 못 막는 것
 * 시계열이 **실제로 저장되는지**는 라이브에서만 확인된다(D1 write 경로). 여기서 고정하는 것은
 * 누적 산수·창 상한·KST 경계·배선뿐이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  appendCollectFunnel, funnelSummary, kstDay, FUNNEL_DAYS, FUNNEL_ROUNDS,
  type CollectFunnel, type FunnelRound,
} from '@/features/marketing/api/influencer-collect-funnel'

const round = (at: number, over: Partial<FunnelRound> = {}): FunnelRound => ({
  at, saved: 100, planned: 16, processed: 7, spent: 56, budget: 56,
  yt: { found: 141, saved: 24, spend: 37 },
  nb: { found: 538, saved: 317, spend: 19 },
  ...over,
})

/** 2026-08-11 09:00 UTC = KST 18:00 (같은 날) */
const T = Date.UTC(2026, 7, 11, 9, 0, 0)

describe('누적', () => {
  it('첫 회차가 하루 한 줄을 만든다', () => {
    const f = appendCollectFunnel(null, round(T))
    expect(f.days).toHaveLength(1)
    expect(f.days[0]).toMatchObject({ d: '2026-08-11', n: 1, saved: 100, ytS: 24, nbS: 317 })
    expect(f.recent).toHaveLength(1)
  })

  it('같은 날 두 번째 회차는 합산된다 (줄이 늘지 않는다)', () => {
    const f = appendCollectFunnel(appendCollectFunnel(null, round(T)), round(T + 3600_000))
    expect(f.days).toHaveLength(1)
    expect(f.days[0]).toMatchObject({ n: 2, saved: 200, spent: 112, ytB: 74, nbB: 38 })
  })

  it('날이 바뀌면 새 줄', () => {
    const f = appendCollectFunnel(appendCollectFunnel(null, round(T)), round(T + 86400_000))
    expect(f.days.map(x => x.d)).toEqual(['2026-08-11', '2026-08-12'])
  })

  /**
   * 🇰🇷 워커 런타임은 UTC 다. UTC 로 자르면 **한국 기준 하루가 두 날에 갈린다** — 이 레포가
   * 반복해 틀린 자리(CLAUDE.md 시각 규칙)라 경계값을 못 박는다.
   */
  it('🔒 KST 로 묶는다 — UTC 15:00 은 이미 다음날이다', () => {
    expect(kstDay(Date.UTC(2026, 7, 11, 14, 59))).toBe('2026-08-11')
    expect(kstDay(Date.UTC(2026, 7, 11, 15, 0))).toBe('2026-08-12')   // KST 자정
  })

  it('🔒 창이 무한히 자라지 않는다 (이 JSON 은 다른 관측값과 한 행을 쓴다)', () => {
    let f: CollectFunnel | null = null
    for (let i = 0; i < 40; i++) f = appendCollectFunnel(f, round(T + i * 86400_000))
    expect(f!.days).toHaveLength(FUNNEL_DAYS)
    expect(f!.days[f!.days.length - 1].d).toBe(kstDay(T + 39 * 86400_000))   // 최신이 남는다
    let g: CollectFunnel | null = null
    for (let i = 0; i < 40; i++) g = appendCollectFunnel(g, round(T + i * 60_000))
    expect(g!.recent).toHaveLength(FUNNEL_ROUNDS)
  })

  it('깨진 이전 값이 수집을 막지 않는다 (관측이 본업을 죽이면 본말전도)', () => {
    const f = appendCollectFunnel({ days: 'broken', recent: null } as unknown as CollectFunnel, round(T))
    expect(f.days).toHaveLength(1)
  })
})

describe('요약 — 총계가 아니라 요청당 수확', () => {
  /**
   * 회차 예산이 **100% 소진**되는 것이 실측(`spent 56 / budget_total 56`)이라, 희소자원은 시간이 아니라
   * 서브리퀘스트다. 총계만 보면 "오늘 적게 들어왔다"까지만 알고 **왜**를 모른다.
   */
  it('🔒 요청당 수확과 계획 소화율을 낸다', () => {
    const f = appendCollectFunnel(null, round(T))
    const [s] = funnelSummary(f)
    expect(s.perReq).toBeCloseTo(100 / 56, 2)
    expect(s.ytPerReq).toBeCloseTo(24 / 37, 2)
    expect(s.nbPerReq).toBeCloseTo(317 / 19, 2)
    expect(s.fill).toBeCloseTo(7 / 16, 2)      // 계획 16 → 처리 7
  })

  it('0 나눗셈이 NaN 을 만들지 않는다', () => {
    const f = appendCollectFunnel(null, round(T, { spent: 0, planned: 0, yt: { found: 0, saved: 0, spend: 0 }, nb: { found: 0, saved: 0, spend: 0 } }))
    const [s] = funnelSummary(f)
    expect([s.perReq, s.ytPerReq, s.nbPerReq, s.fill].every(Number.isFinite)).toBe(true)
  })

  it('빈 값이면 빈 배열', () => {
    expect(funnelSummary(null)).toEqual([])
  })
})

describe('배선 · 대표 지시 보존', () => {
  const SRC = fs.readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')

  it('🔒 수집 레인이 실제로 시계열을 얹는다 (안 부르면 없는 것과 같다)', () => {
    expect(SRC).toMatch(/funnel: appendCollectFunnel\(prev\?\.funnel, \{/)
  })

  /**
   * 🩸 회차는 이미 `spent 56 / 56` 로 예산을 **100% 소진**한다. 여기서 D1 쓰기를 하나라도 더하면
   *   그만큼 발굴이 잘린다 — **관측을 만들려다 관측 대상을 줄이는** 셈이다. 그래서 시계열은
   *   이미 저장되는 stats blob 안에 얹는다(새 쓰기 0개). 이 배선이 깨지면 그 전제가 무너진다.
   */
  it('🔒 새 D1 쓰기를 만들지 않는다 (stats blob 안에 얹힌다)', () => {
    const funnelSrc = fs.readFileSync('src/features/marketing/api/influencer-collect-funnel.ts', 'utf8')
    expect(funnelSrc).not.toMatch(/DB\.prepare|writeSetting|INSERT|UPDATE/)   // 순수함수여야 한다
  })

  /**
   * 🚫 **대표 지시 (2026-08-11): "유튜브는 최대한 계속 받아내고 싶어".**
   *   같은 날 조사에서 *"요청당 제안가능 리드 네이버 3.07 vs 유튜브 0.28"* 이 나왔고 유튜브 축소를
   *   제안했는데 **명시적으로 거부**됐다. 이 시계열을 보면 그 숫자가 매일 보이므로, 다음 세션이
   *   "비효율이니 줄이자"로 갈 유혹이 구조적으로 생긴다 — 그 결정은 **이미 내려졌다**는 사실을 코드에 남긴다.
   */
  it('🔒 유튜브 축소 금지 지시가 코드에 남아 있다', () => {
    const funnelSrc = fs.readFileSync('src/features/marketing/api/influencer-collect-funnel.ts', 'utf8')
    expect(funnelSrc).toMatch(/유튜브는 최대한 계속 받아내고 싶어/)
    expect(funnelSrc).toMatch(/유튜브 삭감이 아니다|명시적으로 \*\*거부\*\*/)
  })
})
