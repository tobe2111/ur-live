/**
 * ⏱️ **인보케이션당 작업 상한** — CPU 한도 초과의 근본 수리 (2026-07-31 라이브 확정).
 *
 * ## 무엇이 확정됐나 (Cloudflare 대시보드 실측)
 * ```
 *   Errors by invocation status → Exceeded CPU Time Limits: 168  (메모리·내부·예외 전부 0)
 *   Error Rate 30.3% · CPU P50 10.1ms / P90 64.78ms / P99 189ms (스파이크 ~1초)
 * ```
 * 오류의 **100%가 CPU 한도**다. 중앙값(10.1ms)은 멀쩡하고 **꼬리만 터진다** —
 * 즉 전체가 무거운 게 아니라 특정 레인이 한 인보케이션에서 너무 많이 한다.
 *
 * 재분류가 그 대표다: 루프가 `for(;;)` 로 **D1 예산이 바닥날 때까지** 돌아
 * 풀 40,375행을 한 번에 훑을 수 있다 → 행당 정규식 ~20개 = **80만 회 실행**.
 *
 * ## ⚠️ 페이지 크기를 줄이는 건 답이 아니다
 * `PAGE` 를 3,000 → 500 으로 줄여도 **루프가 6배 더 돌 뿐 총량이 같다.**
 * 막아야 하는 것은 페이지가 아니라 **인보케이션당 총 작업량**이다.
 * (이 함정을 실제로 밟을 뻔했고, 루프 구조를 다시 읽고서야 알았다.)
 *
 * ✅ 커버리지 손실 0: 커서가 이미 이어받기를 지원한다(그 docblock 이 존재 이유를 적어 뒀다).
 *    조기 중단 시 `done` 을 false 로 남겨야 커서가 0 으로 리셋되지 않는다 — 아래에서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  poolScanShouldStop, POOL_SCAN_MAX_ROWS, POOL_SCAN_MAX_MS,
} from '@/features/marketing/api/influencer-performance'

const T0 = 1_000_000

describe('poolScanShouldStop — 한 인보케이션의 몫', () => {
  it('행 상한에 닿으면 멈춘다', () => {
    expect(poolScanShouldStop(POOL_SCAN_MAX_ROWS, T0, T0 + 10)).toBe(true)
    expect(poolScanShouldStop(POOL_SCAN_MAX_ROWS - 1, T0, T0 + 10)).toBe(false)
  })
  it('시간 상한에 닿으면 멈춘다 — 행이 적어도(무거운 본문) 시간이 먼저 갈 수 있다', () => {
    expect(poolScanShouldStop(10, T0, T0 + POOL_SCAN_MAX_MS)).toBe(true)
    expect(poolScanShouldStop(10, T0, T0 + POOL_SCAN_MAX_MS - 1)).toBe(false)
  })
  it('상한이 전 풀보다 작다 — 아니면 한 인보케이션이 4만 행을 다 훑는 현 상태 그대로다', () => {
    expect(POOL_SCAN_MAX_ROWS).toBeLessThan(40_000)
    expect(POOL_SCAN_MAX_MS).toBeLessThanOrEqual(10_000)
  })
  it('손상값에 throw 하지 않는다', () => {
    expect(poolScanShouldStop(NaN, T0, T0 + 10)).toBe(false)
    expect(poolScanShouldStop(0, NaN, T0)).toBe(false)
  })
})

describe('🚧 배선 — 루프가 실제로 상한을 본다', () => {
  const src = readFileSync('src/features/marketing/api/influencer-performance.ts', 'utf8')

  it('재분류 루프가 poolScanShouldStop 으로 중단한다', () => {
    // 순수함수만 만들고 루프에 안 걸면 CPU 는 그대로 터진다 — 조용히 아무 일도 안 일어난다.
    expect(src).toMatch(/if \(poolScanShouldStop\(scanned, startedMs, Date\.now\(\)\)\) break/)
    expect(src).toMatch(/const startedMs = Date\.now\(\)/)
  })

  it('🔒 조기 중단은 `done` 을 true 로 만들지 않는다 — 커서가 0 으로 리셋되면 앞부분만 영원히 반복한다', () => {
    // `done` 이 true 면 커서가 0 으로 리셋된다(아래 INSERT). 상한으로 멈춘 것은 '완주'가 아니다.
    // ⚠️ 앵커는 **함수 이름**이다. 예전엔 `let scanned = 0, changed = 0, done = false` 선언문에 걸어 뒀는데,
    //   2026-08-03 에 `stamped` 카운터가 추가되자 정규식이 안 맞아 `loop` 가 빈 문자열이 됐다.
    //   아래 길이 검사가 그걸 잡아 줬다(그래서 이 줄이 있다) — 선언문은 자주 바뀌니 이름으로 잡는다.
    const loop = /export async function runReclassifyPool[\s\S]*?INSERT OR REPLACE INTO platform_settings/.exec(src)?.[0] || ''
    expect(loop.length).toBeGreaterThan(500)          // 루프를 못 찾으면 검사가 헛도는 것이다
    // ⚠️ `includes('poolScanShouldStop')` 로 찾으면 **주석 줄**이 먼저 잡힌다(실제로 밟았다) — 호출부만 본다.
    const stopLine = loop.split('\n').find(l => l.includes('if (poolScanShouldStop(')) || ''
    expect(stopLine).toContain('break')
    expect(stopLine).not.toContain('done = true')
  })
})

/**
 * 🔁 **같은 사고를 공유하는 두 번째 레인** — 재추출(`phase=reextract`, 실패 레인 중 하나).
 *
 * 구조가 재분류와 **동일**하다: `for(;;)` + D1 예산/짧은 페이지만 보는 정지 조건 + 행마다 정규식.
 * 한쪽만 고치면 반쪽이라 **같은 상한을 공유**한다(SSOT — 상한을 조정할 때 두 곳이 갈라지지 않게).
 */
describe('🚧 배선 — 재추출 레인도 같은 상한을 쓴다', () => {
  const src = readFileSync('src/features/marketing/api/influencer-maintenance.ts', 'utf8')
  it('reextractPoolContacts 루프가 poolScanShouldStop 으로 중단한다', () => {
    expect(src).toMatch(/if \(poolScanShouldStop\(scanned, startedMs, Date\.now\(\)\)\) break/)
    expect(src).toMatch(/const startedMs = Date\.now\(\)/)
  })
  it('조기 중단이 `done` 을 true 로 만들지 않는다 — 커서 리셋 금지', () => {
    const line = src.split('\n').find(l => l.includes('if (poolScanShouldStop(')) || ''
    expect(line).toContain('break')
    expect(line).not.toContain('done = true')
  })
})
