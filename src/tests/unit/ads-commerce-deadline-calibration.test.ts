/**
 * ⏱️ **한 회차가 태우는 몫을 묶는다** — 2026-08-09.
 *
 * ## ⚠️ 먼저: 이 파일의 첫 판은 **틀린 모델**을 고정하고 있었다
 * 처음엔 *"마감선 ≤ 관측 사망점 / 2"* 를 강제했다. 레인마다 고정된 사망점이 있다는 전제였는데,
 * 배포 뒤 08-09 05:00 KST 회차가 그 전제를 반증했다 — **손대지 않은 레인들이 자기 사망 기록보다
 * 한참 위에서 살아남았다**:
 *
 * ```
 * collect-storeinfo  13,833ms 사망 → 20,668ms 생존   (코드 변경 0)
 * collect-hira       21,067ms 사망 → 12,415ms 생존   (코드 변경 0)
 * collect-neis                       30,697ms 생존   (관측 최고)
 * ```
 *
 * ⇒ 죽는 지점은 **레인의 성질이 아니라 그 회차의 성질**이다(부모/형제가 그 틱에서 이미 태운 CPU).
 *   그리고 **우리는 그 여유를 볼 수 없다** — 워커가 CPU 시간을 안 주고 `Date.now()` 는 I/O 에서만 흐른다.
 *   같은 회차에 셋이 함께 살아난 것도 결정적이다: 하나만 고쳤는데 셋 다 살았다면 살린 건 상수가 아니다.
 *
 * ## 그래서 무엇을 지키나 — **절대 상한, 비교가 아니다**
 * 맞출 대상이 없으니 "사망점의 몇 %" 같은 비율은 의미가 없다. 할 수 있는 건 **우리 몫을 작게 유지**해
 * 나쁜 틱에서 넘어갈 확률을 낮추는 것뿐이다. 그래서 두 상수에 **천장**을 건다 —
 * 되돌리거나 슬금슬금 올리는 것을 막는 것이 이 파일의 전부다.
 *
 * 근거가 되는 실측(08-09 05:00 KST, 이 값으로 돈 첫 회차):
 *   `found=499`(1페이지) · `stopped_by=deadline` · 루프 `elapsed_ms=9,113` · `page 356 → 357` 전진.
 *   종전 값에선 3페이지 1,499건이었다.
 *
 * ## ⚠️ 이 테스트가 **못** 하는 것
 *  · 이 상수가 **사망을 막는다고 보장하지 않는다.** 여유는 틱마다 다르고 우리는 못 본다.
 *    확률을 낮출 뿐이다 — 이 파일을 "이제 안 죽는다"의 근거로 인용하지 말 것.
 *  · 다른 레인에 같은 숫자를 강요하지 않는다. `neis` 가 30.7초에 사는 것이 반증이다.
 *    **마감선은 레인마다 다른 값이다** — 공용 상수로 묶지 말 것.
 *  · 수확 감소(1,499 → 499)는 이 상수의 **대가**다. 되찾으려면 마감선을 올릴 게 아니라
 *    레코드당 CPU 를 줄여야 한다(여유를 안 쓰고 수확만 늘리는 유일한 길).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/features/marketing/api/commerce-notify-collect.ts'), 'utf8')

/**
 * 이 값들로 실제로 살아남은 회차를 관측했다(08-09 05:00 KST). 천장이지 목표가 아니다 —
 * 더 내리는 것은 언제든 자유롭고, **올리는 것만 막는다**.
 */
const CEILING = { deadlineMs: 6_000, recordsPerRun: 700 }

const num = (name: string): number => {
  const m = SRC.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+)`))
  expect(m, `${name} 상수를 못 찾았다 — 이름이 바뀌었으면 이 테스트도 함께 고칠 것`).toBeTruthy()
  return Number(m![1].replace(/_/g, ''))
}

describe('collect-commerce — 한 회차가 태우는 몫의 천장', () => {
  it('🔒 무료 마감선은 실측 생존값 이하로 유지 — 여유를 볼 수 없으니 우리 몫을 작게 둔다', () => {
    expect(num('RUN_DEADLINE_MS')).toBeLessThanOrEqual(CEILING.deadlineMs)
  })

  it('🔒 레코드 상한도 함께 — 응답이 빨라 마감선에 안 걸려도 파싱이 CPU 를 먹는다', () => {
    expect(num('MAX_RECORDS_PER_RUN')).toBeLessThanOrEqual(CEILING.recordsPerRun)
  })

  it('🔒 유료 마감선은 무료보다 크되 유료 CPU 한도(30초) 아래 — 전환 시 코드 변경 0', () => {
    const free = num('RUN_DEADLINE_MS')
    const paid = num('RUN_DEADLINE_MS_PAID')
    expect(paid).toBeGreaterThan(free)
    expect(paid).toBeLessThan(30_000)
  })

  it('🔒 마감선에서 끊고 **커서를 남긴다** — 죽으면 커서 저장이 안 돌아 다음 회차가 같은 페이지를 또 훑는다', () => {
    // 이게 이 레인의 진짜 실패 모드다(사망 = 그 회차 전진 0). 끊는 분기가 사라지면 그 상태로 돌아간다.
    expect(SRC).toMatch(/stoppedBy\s*=\s*'deadline'/)
    expect(SRC).toMatch(/stoppedBy\s*=\s*'records'/)
  })

  it('🔒 틀린 모델("사망점의 절반")이 주석으로 되살아나지 않는다 — 그게 다음 세션을 잘못 이끈다', () => {
    // 08-09 실측이 반증한 문장이다. 지우고 나서 다시 적히면 같은 오진이 반복된다.
    expect(SRC).not.toMatch(/사망점의?\s*절반/)
  })
})
