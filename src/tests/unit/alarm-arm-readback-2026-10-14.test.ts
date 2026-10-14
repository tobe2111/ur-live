/**
 * 🔬 **알람 예약이 실제로 걸렸는지 되읽는다** — 2026-10-14 라이브 실측에서 나온 관측 추가.
 *
 * ## 왜 (추측 아님 — 스탬프를 D1 에서 읽어 비교했다, 17:16:45Z)
 * ```
 *   레인                  at        next_at    지연      runs  cap
 *   enrich-influencer    17:00:55  17:01:55   **15분**   1     60
 *   maintenance          17:01:26  17:02:26   **14분**   2     60
 *   collect              17:01:07  17:02:07   **15분**   1     3
 *   maintenance-rescan   17:00:00  18:00:00    -43분     1     1   ← 통제군(정상)
 * ```
 * `cap=60 · interval_ms=60000` 이므로 **설계는 시간당 60회**인데 하트비트 실측은 **1~2회/시간**이다
 * (정시에 전부 리셋 → 그 시간 내내 단조증가 → 48분, 14샘플). 통제군이 가리키는 바:
 * `cap` 을 소진해 **다음 정시**로 잡은 알람은 깨어나고 **1분 뒤**로 잡은 알람만 안 깨어난다.
 *
 * ## 🕳️ 그런데 밖에서는 원인을 가를 수 없었다
 * `setAlarm(at).catch(() => undefined)` 가 실패를 삼키고 스탬프는 **그 뒤에** `next_at` 을 적는다
 * ⇒ 아래 둘이 **완전히 같은 기록**을 남긴다:
 *   ① `setAlarm` 실패 → *"예약했다고 적었는데 예약은 없다"*   (고칠 자리: 코드)
 *   ② 예약은 걸렸는데 런타임이 안 깨운다                      (고칠 자리: 요금제·플랫폼 설정)
 * 둘은 처방이 완전히 다르다. 그래서 `set_ok` + `armed_at`(되읽은 값)을 남긴다.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - 실제로 어느 쪽이었는지. 그건 **배포 후 라이브 스탬프**만 안다(`armed_at === null` → ①).
 * - DO 런타임 동작. `LaneAlarm` 은 Durable Object 라 유닛에서 인스턴스화할 수 없다 ⇒ 이 파일은
 *   **계약(어떤 값이 기록되는가)** 만 고정하고, 판정은 라이브가 한다.
 * - 되읽기가 플랫폼에서 정확한지(`getAlarm()` 이 방금 쓴 값을 바로 돌려주는지).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

const SRC = join(process.cwd(), 'src/worker-ads/lane-alarm.ts')
const raw = readFileSync(SRC, 'utf-8')
const code = stripComments(raw)

describe('①② 를 가르는 값이 스탬프에 남는다', () => {
  it('측정 대상이 비면 통과가 아니라 실패 — 경로가 낡아 조용히 비는 것을 막는다', () => {
    expect(raw.length).toBeGreaterThan(5_000)
    // 주석 제거기가 소스를 통째로 먹는 사고를 이 레포는 네 번 겪었다(`check-comment-stripper`).
    expect(code.length).toBeGreaterThan(Math.floor(raw.length * 0.3))
    expect(code).toContain('setAlarm')
  })

  it('`setAlarm` 실패를 **포착**한다 — 삼키고 끝내지 않는다', () => {
    // 종전: `setAlarm(at).catch(() => undefined)` → 실패가 기록에 안 남는다.
    expect(code).toMatch(/setAlarm\(at\)\.catch\(\(\)\s*=>\s*\{\s*setOk\s*=\s*false\s*\}\)/)
    expect(code).toMatch(/let\s+setOk\s*=\s*true/)
  })

  it('예약 직후 `getAlarm()` 으로 **되읽고**, 그 실패도 삼킨다(관측이 레인을 멈추면 안 된다)', () => {
    expect(code).toMatch(/getAlarm\(\)\.catch\(\(\)\s*=>\s*null\)/)
    /**
     * 되읽기는 반드시 예약 **뒤**여야 한다 — 앞에 두면 직전 회차의 값을 읽는다.
     * 🩸 첫 판은 `indexOf('getAlarm()')` 로 썼는데 **되살리기 경로(`:70`)의 `getAlarm()` 이
     *   먼저 걸려** 멀쩡한 코드에 빨간불이 났다. 앵커는 이 자리에서 고유한 모양이어야 한다
     *   (이 세션에서 같은 실수를 세 번째로 했다).
     */
    expect(code.indexOf('getAlarm().catch(() => null)')).toBeGreaterThan(code.indexOf('setAlarm(at)'))
  })

  it('두 값이 스탬프에 실린다 — 하나만 있으면 ①②가 여전히 안 갈린다', () => {
    expect(code).toMatch(/set_ok:\s*setOk/)
    expect(code).toMatch(/armed_at:\s*armed\s*!=\s*null\s*\?/)
    // `armed_at` 은 ISO 문자열로 — 밀리초 숫자를 그대로 넣으면 `next_at` 과 눈으로 비교가 안 된다.
    expect(code).toMatch(/armed_at:[^\n]*toISOString\(\)/)
  })

  it('반대 방향 — 관측을 넣다가 **예약 자체를 빼지 않았다**', () => {
    // 이 줄이 사라지면 레인이 통째로 멎는다(관측은 멀쩡해 보이고).
    expect(code).toMatch(/const\s+at\s*=\s*nextWakeAt\(/)
    expect(code).toMatch(/\.setAlarm\(at\)/)
  })

  it('반대 방향 — 예약 실패 시 **기본값이 `true` 로 굳지 않는다**(거짓 안심)', () => {
    // `setOk` 를 `const setOk = true` 로 바꾸면 실패를 영원히 성공으로 보고한다.
    expect(code).not.toMatch(/const\s+setOk\s*=\s*true/)
  })
})
