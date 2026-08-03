/**
 * 🔬 **재시도를 실험으로 쓴다** — 계약 (2026-08-03 라이브 실측 후 신설).
 *
 * ## 왜 이게 필요했나
 * `collect-hira` 는 **60회 실행에 저장 0**, 매번 `AbortSignal.timeout(25000)` 이다.
 * 그런데 프로브로 **같은 워커·같은 키·같은 주소**를 찌르면 `rows 1~500` 전부 **즉답 200** 이다.
 * 같은 :00 에 같은 게이트웨이를 때리는 `commerce`(누적 130,795)·`storeinfo`(14,271)도 **성공한다**.
 * ⇒ "정각엔 게이트웨이가 바쁘다" 하나로는 설명이 안 되고, **더 좁힐 관측이 없었다.**
 *
 * ## 이 배선이 하는 일
 * 첫 시도가 timeout 이면 **회차당 1회만** 더 작은 페이지로 재시도하고, 그 결과를 `diag.retry` 에 남긴다.
 *   · 작은 페이지로 성공 → 페이지 크기 문제 (`ADS_HIRA_ROWS` 로 **무배포** 해결)
 *   · 작은 페이지도 실패 → 페이지 크기 **무관** (동시성·외부 — 회차 분산을 봐야 한다)
 * 즉 **다음 회차가 스스로 원인을 가른다.** 어느 쪽이든 지금보다 나빠지지 않는다(실패해도 현행과 동일).
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 네트워크 동작(여기선 배선만 본다). 판정은 라이브 `diag.retry` 로.
 * - 재시도가 **원인을 고치지는 않는다.** 이건 관측이지 처방이 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/hira-hospital-collect.ts'), 'utf8')

describe('심평원 — 재시도가 원인을 가른다', () => {
  it('🔒 timeout 일 때만 재시도한다 — 아무 실패에나 재시도하면 예산만 태운다', () => {
    expect(SRC).toMatch(/if \(!res && !retried && \/timeout\|abort\/i\.test\(netMsg\)\)/)
  })

  it('🔒 **회차당 1회**로 묶여 있다 — 플래그를 세우지 않으면 페이지마다 재시도해 예산이 터진다', () => {
    const block = SRC.slice(SRC.indexOf('if (!res && !retried'))
    expect(block.slice(0, 400), 'retried 를 세우지 않으면 상한이 없다').toMatch(/retried = true/)
  })

  it('🔒 재시도는 **더 작은 페이지**다 — 같은 크기로 다시 쏘면 실험이 아니라 그냥 재시도다', () => {
    expect(SRC).toMatch(/Math\.max\(20, Math\.floor\(numRows \/ 5\)\)/)
  })

  it('🔒 재시도 타임아웃이 첫 시도보다 **짧다** — 같으면 회차 벽시계가 두 배가 된다', () => {
    const first = /await shoot\(numRows, (\d+)\)/.exec(SRC)
    const retry = /await shoot\(small, (\d+)\)/.exec(SRC)
    expect(first, '첫 시도를 못 찾았다(상수명이 바뀌었나)').toBeTruthy()
    expect(retry, '재시도를 못 찾았다').toBeTruthy()
    expect(Number(retry![1])).toBeLessThan(Number(first![1]))
  })

  it('🔒 두 결과가 **서로 다른 결론**을 남긴다 — 같은 문구면 관측 가치가 0 이다', () => {
    const ok = /재시도 성공 ⇒ ([^`]+)/.exec(SRC)
    const ng = /재시도도 실패 ⇒ ([^`]+)/.exec(SRC)
    expect(ok, '성공 결론이 없다').toBeTruthy()
    expect(ng, '실패 결론이 없다').toBeTruthy()
    expect(ok![1]).not.toBe(ng![1])
    expect(ok![1], '성공 시 다음 행동(무배포 노브)이 문구에 있어야 한다').toMatch(/ADS_HIRA_ROWS/)
  })

  it('🔒 결과가 **저장까지 간다** — diag 에 안 실리면 아무도 못 본다', () => {
    expect(SRC).toMatch(/retry\?: string/)
    expect(SRC, '스탬프에 retryNote 가 실려야 한다').toMatch(/retry: retryNote/)
  })
})
