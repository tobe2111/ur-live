/**
 * 📏 레인별 읽기·쓰기 가시화 — `lane-alarm.ts` 하트비트 계약.
 *
 * ## 왜 생겼나 (2026-09-05)
 * 계측기(`this.meter.rr/rw`)는 원래부터 회차마다 돌고 있었는데, 공용 원장에 **더하고 나서
 * 레인별 값은 버렸다**. 그래서 이 질문에 아무도 답을 못 했다:
 * ```
 *   하루 쓰기 37만 · 읽기 2억이 **어느 레인** 것인가?
 * ```
 * 그 빈자리를 추측으로 메우다 **두 번 틀렸다** — 재측정 주기 필터(#1333)와 재조우 백필(#1348)
 * 둘 다 "쓰기의 주범"이라 보고 고쳤지만 배포 후 감소가 **0** 이었다(122K/시간 → 123K/시간).
 * 값은 이미 손에 있었다. 버리지만 않으면 된다.
 *
 * ## 이 시험이 지키는 것
 *   ① 하트비트가 rr·rw 를 싣는다(안 실으면 다시 추측으로 돌아간다)
 *   ② 그 값은 **계측기에서** 온다(0 을 하드코딩하면 조용히 무의미해진다)
 *   ③ stats 가 잘려도 살아남는다 — 잘림은 `base` 가 아니라 `stats` 만 버리므로
 *
 * ⚠️ **못 막는 것**: 계측기 자체가 실제 D1 읽기/쓰기를 정확히 세는지는 여기서 검증 못 한다
 *   (그건 `d1-read-meter` 의 몫이고, 최종 판정은 Cloudflare D1 analytics 와의 대조다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { serializeLaneStamp } from '@/worker-ads/lane-run-history'

const SRC = 'src/worker-ads/lane-alarm.ts'
const src = readFileSync(SRC, 'utf8')

/** 하트비트 스탬프를 만드는 블록만 잘라 본다 — 파일의 다른 meter 사용처에 걸리지 않게. */
function stampBlock(): string {
  const i = src.indexOf('serializeLaneStamp({')
  expect(i, '하트비트 스탬프 조립부를 못 찾았다 — 코드가 이동했다').toBeGreaterThan(-1)
  const j = src.indexOf('}, stats ?', i)
  expect(j).toBeGreaterThan(i)
  return src.slice(i, j)
}

describe('레인 하트비트 — 회차별 읽기·쓰기를 남긴다', () => {
  it('① rr·rw 두 값을 싣는다', () => {
    const b = stampBlock()
    expect(b, 'rr 이 없으면 읽기 2억의 출처를 다시 추측하게 된다').toMatch(/\brr:/)
    expect(b, 'rw 가 없으면 쓰기 37만의 출처를 다시 추측하게 된다').toMatch(/\brw:/)
  })

  it('② 값의 출처는 계측기다 — 상수를 박으면 조용히 무의미해진다', () => {
    const b = stampBlock()
    expect(b).toMatch(/rr: this\.meter\.rr/)
    expect(b).toMatch(/rw: this\.meter\.rw/)
  })

  it('③ 계측기가 비어 있어도 필드는 남는다(undefined 면 JSON 에서 통째로 사라진다)', () => {
    const b = stampBlock()
    expect(b).toMatch(/rr: this\.meter\.rr \|\| 0/)
    expect(b).toMatch(/rw: this\.meter\.rw \|\| 0/)
  })

  it('④ stats 가 잘려도 rr·rw 는 살아남는다 — 큰 stats 로 실제 확인', () => {
    const big = { blob: 'x'.repeat(5000) }   // budget(2000) 을 확실히 넘긴다
    const out = serializeLaneStamp({ at: 'now', lane: 'collect', rr: 12345, rw: 678 }, big)
    const parsed = JSON.parse(out) as Record<string, unknown>
    expect(parsed.stats_omitted, 'stats 가 잘렸어야 이 검사가 의미 있다').toBe(true)
    expect(parsed.rr).toBe(12345)
    expect(parsed.rw).toBe(678)
  })

  it('⑤ 안 잘리는 평범한 회차에서도 그대로 실린다', () => {
    const out = serializeLaneStamp({ at: 'now', lane: 'collect', rr: 7, rw: 3 }, { saved: 12 })
    const parsed = JSON.parse(out) as Record<string, unknown>
    expect(parsed.rr).toBe(7)
    expect(parsed.rw).toBe(3)
    expect((parsed.stats as Record<string, unknown>).saved).toBe(12)
  })
})
