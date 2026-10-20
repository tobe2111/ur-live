/**
 * 🔒 보강 레인 **동시 처리의 안전 불변식** — 2026-07-29 동시화(#857)와 함께 박는다.
 *
 *   왜 테스트로 남기나: 동시화의 안전성이 **주석에만** 있으면 다음 세션이 리팩토링 중에 조용히 깨뜨린다.
 *   깨져도 예외가 안 나고, 증상은 "Too many subrequests" 라는 *다른 레인의* 실패로 나타난다 —
 *   이 레포가 오늘 하루 종일 쫓아다닌 바로 그 실패 양식이라, 원인을 여기로 되짚기 어렵다.
 *
 *   ⚠️ 이 테스트가 **못 막는 것**: 실제 동시 실행의 경합은 소스 검사로 증명되지 않는다. 여기서 고정하는 건
 *   "그 경합이 불가능해지는 코드 형태"뿐이다(검사↔차감 사이 await 부재 · 동시성 상한). 런타임 동작은
 *   PR #857 본문의 워커 풀 실행 검증(순차 3/12 → 동시 9/12, 중복 0, 잔량 음수 0)이 담당한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/influencer-performance.ts'), 'utf8')

describe('enrichNaverActivity — 동시 처리 안전 불변식', () => {
  it('예산 [잔량 검사 → 차감] 사이에 await 가 없다 (있으면 동시 워커가 같은 잔량을 두 번 쓴다)', () => {
    // 2026-08-02: 가드가 두 줄로 갈렸다(잔량 검사 + 마감 창 검사) — 앵커를 **잔량 검사**로 옮긴다.
    //   옛 앵커 `if (budget.left <= 1 || (budget.deadline && Date.now() >= ...)) return` 은 소멸.
    const guard = SRC.indexOf('if (budget.left <= 1) return')
    expect(guard, '예산 가드를 못 찾았다 — 리팩토링됐다면 이 테스트도 함께 갱신할 것').toBeGreaterThan(0)
    const spend = SRC.indexOf('budget.left -= wantHome ? 2 : 1', guard)
    expect(spend, '차감 지점을 못 찾았다 — 위와 동일').toBeGreaterThan(guard)
    // 이 구간이 전부 동기 구문이어야 원자적으로 실행된다(JS 단일 스레드).
    const between = SRC.slice(guard, spend)
    expect(between).not.toMatch(/\bawait\b/)
    // 🔒 마감 창 가드도 이 구간 안에 있어야 한다(2026-08-02). 차감 **뒤로** 옮기면 예산을 깎아 놓고
    //   포기하게 돼 잔량이 새 나간다 — 그 형태를 여기서 막는다.
    expect(between, '마감 창 가드가 [검사→차감] 구간 밖으로 나갔다').toMatch(/canStartBudgetedItem\(/)
  })

  it('동시성 상한이 보수적 범위(1~4) 안에 있다 — 호스트당 연결을 과하게 열면 차단으로 되돌아온다', () => {
    const m = SRC.match(/const NAVER_CONCURRENCY = (\d+)/)
    expect(m, 'NAVER_CONCURRENCY 상수를 못 찾았다').toBeTruthy()
    const n = Number(m![1])
    expect(n).toBeGreaterThanOrEqual(1)
    // 우리가 때리는 호스트는 둘(rss./m.blog.naver.com) — 흔한 6-per-host 한도 아래에 머문다.
    // 올리려면 먼저 라이브 `diag.failed` 가 안 오르는지 확인할 것(추측으로 올리면 조용히 악화된다).
    expect(n).toBeLessThanOrEqual(4)
  })

  it('워커가 커서를 공유한다 — 각자 rows 를 처음부터 돌면 같은 블로거를 중복 조회한다', () => {
    expect(SRC).toMatch(/let cursor = 0/)
    expect(SRC).toMatch(/rows\[cursor\+\+\]/)
  })
})
