/**
 * 🫀 **레인이 자기 하트비트를 쓴다** — 계약 (2026-07-29 라이브 실측 후 신설).
 *
 *   왜: 하트비트를 지금까지 **부모 cron 이** 썼다 — `await SELF.fetch(레인)` 의 **응답을 받은 뒤에**.
 *   그런데 부모의 수명은 느린 레인의 작업 시간보다 짧고, 피호출자는 호출자보다 오래 못 산다(#874).
 *   실측: `reclassify` 자기 스탬프 **16:01:09**(= 일을 끝냈다) ↔ 하트비트 **13:01**(3시간 전),
 *   `collect-commerce` 는 기록이 **아예 없다**. 즉 *일을 끝낸 레인의 기록이 사라진다*.
 *
 *   여기서 고정하는 것: ① 부모가 이름·주기를 넘긴다(레인은 자기 주기를 모른다)
 *   ② 이름은 **경로에서 유추하지 않는다**(옛 이름이 남아 stale watch 가 영원히 우는 사고)
 *   ③ 파라미터가 없으면 아무것도 하지 않는다(수동 트리거 무영향).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { laneUrl, readBeatParams, BEAT_PARAM, GAP_PARAM } from '@/worker-ads/self-beat'

describe('laneUrl — 부모가 이름·주기를 넘긴다', () => {
  it('쿼리 없는 경로', () => {
    expect(laneUrl('/__ads/collect-neis', 'collect-neis', 60))
      .toBe('https://ur-ads/__ads/collect-neis?_beat=collect-neis&_gap=60')
  })

  it('🔒 이미 쿼리가 있으면 `&` 로 잇는다 — `?` 를 또 붙이면 레인이 자기 파라미터를 잃는다', () => {
    const u = laneUrl('/__ads/reclassify-company?passes=5', 'reclassify-company?passes=5', 150)
    expect(u).toContain('passes=5')
    expect(u).toContain('&_beat=')
    expect(new URL(u).searchParams.get('passes')).toBe('5')
  })

  it('이름에 쿼리가 들어가도 안전하게 인코딩된다(그 이름이 라이브의 실제 키다)', () => {
    const u = laneUrl('/__ads/maintenance?phase=merge', 'maintenance?phase=merge', 720)
    expect(readBeatParams(u)!.beat).toBe('maintenance?phase=merge')
  })

  it('주기를 안 주면 안 넘긴다 — 0/음수도 안 넘긴다(잘못된 주기는 오탐을 만든다)', () => {
    expect(laneUrl('/__ads/x', 'x')).not.toContain(GAP_PARAM)
    expect(laneUrl('/__ads/x', 'x', 0)).not.toContain(GAP_PARAM)
    expect(laneUrl('/__ads/x', 'x', -5)).not.toContain(GAP_PARAM)
  })
})

describe('readBeatParams — 레인이 읽는다', () => {
  it('이름과 주기를 되찾는다(왕복이 손실 없이 맞물린다)', () => {
    const p = readBeatParams(laneUrl('/__ads/collect-nps', 'collect-nps', 2910))!
    expect(p.beat).toBe('collect-nps')
    expect(p.gap).toBe(2910)
  })

  it('🔒 파라미터가 없으면 null — 수동 트리거는 하트비트를 남기지 않는다', () => {
    expect(readBeatParams('https://ur-ads/__ads/collect-neis')).toBeNull()
    expect(readBeatParams('https://ur-ads/__ads/collect?passes=5')).toBeNull()
  })

  it('주기가 비숫자/0 이면 없는 것으로 — 기본 판정(매시간)으로 떨어진다', () => {
    expect(readBeatParams(`https://ur-ads/x?${BEAT_PARAM}=a&${GAP_PARAM}=abc`)!.gap).toBeUndefined()
    expect(readBeatParams(`https://ur-ads/x?${BEAT_PARAM}=a&${GAP_PARAM}=0`)!.gap).toBeUndefined()
  })

  it('망가진 URL 에도 터지지 않는다', () => {
    expect(readBeatParams('not a url')).toBeNull()
  })
})

/**
 * 🔗 배선 불변식 — 규칙만 있고 안 쓰이면 관측은 그대로 사라진다.
 * ⚠️ 못 막는 것: 실제 쓰기 성공 여부는 라이브 하트비트로만 확인된다.
 */
describe('worker-ads — self-beat 이 실제로 배선돼 있다', () => {
  /**
   * ⚠️ 2026-08-01: 디스패치 본문이 `index.ts` → `lane-runner.ts` 로 **옮겨갔다**(예산 분산 도입).
   *   불변식은 그대로인데 **가드가 옛 파일만 보고 있어서** 빨간불이 났다 — 이 레포가 잠금표에서
   *   겪은 "낡은 지도" 클래스와 같다. 약화하지 말고 **두 파일을 함께** 본다(어디로 옮겨도 계약은 유지).
   */
  const FILES = ['src/worker-ads/index.ts', 'src/worker-ads/lane-runner.ts']
  const SRC = FILES.map(f => readFileSync(resolve(process.cwd(), f), 'utf8')).join('\n')
  it('🔒 검사 대상이 비어 있지 않다 — 파일이 옮겨가면 통과가 아니라 실패여야 한다', () => {
    expect(SRC.length).toBeGreaterThan(2000)
  })

  it('kick 이 laneUrl 로 이름·주기를 넘긴다(raw 경로로 부르면 레인이 이름을 모른다)', () => {
    expect(SRC).toMatch(/deps\.selfFetch\(new Request\(deps\.laneUrl\(lane\.path, lane\.beat, lane\.gapMin\)/)
  })

  it('레인 미들웨어가 응답 전에 기록한다', () => {
    expect(SRC).toMatch(/app\.use\('\/__ads\/\*'/)
    expect(SRC).toMatch(/writeSelfBeat\(/)
  })

  it('🔒 부모의 쓰기는 폴백으로 남아 있다 — 한쪽만 남기면 다른 실패 모드가 열린다', () => {
    expect(SRC).toMatch(/deps\.beat\(lane\.beat, true/)
    expect(SRC).toMatch(/deps\.beat\(lane\.beat, false/)
  })
})
