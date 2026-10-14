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

/**
 * 🏷️ **②④ 를 가르는 두 번째 값 — 이 회차를 깨운 것이 알람인가 부트스트랩인가.**
 *
 * ## 왜 또 필요한가 (①은 위에서 이미 죽었다)
 * 2026-10-14 18:02:42Z 라이브: `set_ok` 6/6 `true` · `armed_at` 6/6 이 `next_at` 과 일치
 * ⇒ **후보 ①(`setAlarm` 실패) 기각.** 예산·정지 게이트 건너뛰기도 같은 실측에서 기각
 * (`ads:read-budget over=false wover=false cut=없음` · `ads:lanes-paused paused=false`).
 * 남은 둘은 고칠 자리가 완전히 다르다:
 *   **②** 알람이 **걸린 채 제때 배달되지 않는다**(유휴 DO) → `ADS_PLAN`·대시보드(대표)
 *   **④** 배달돼 `alarm()` 이 시작은 하는데 **재예약 전에 죽는다**     → 이 파일
 *
 * ## 🕳️ 기존 계측으로는 못 가린다 — **확인하고 적는다**
 * 매시 부트스트랩이 `getAlarm()` 을 되읽어 `alarmAt`/`revived` 를 찍지만 **:01 에 한 번뿐**이고,
 * 18:01 실측에서 레인 다섯이 **부트스트랩이 보기 직전에 이미 돌아** 신선한 알람을 갖고 있었다
 * ⇒ `revived` 가 아무것도 말해 주지 않았다(`collect` 하나만 `revived=false` = 알람 부재).
 * 하트비트 `at` 으로 순서를 따지려 했으나 `adsBeat` 은 `beats.add` **배치**라 `at` 이 회차 시각이
 * 아니다(다섯 레인이 `ads:scheduled` 와 ms 까지 동일) ⇒ **타임스탬프 비교로는 판정 불가.**
 *
 * 🧭 그래서 이 값을 만들었다 — 그리고 순서가 중요하다: **있는 계측을 전수로 읽어 못 한다는 것을
 * 확인한 뒤에** 새 계측을 만들었다(이 세션에서 그 반대로 해서 계측을 두 벌 만든 적이 있다).
 *
 * ## 판정법 (배포 + 정각 1회 뒤 스탬프)
 * **매시 첫 회차의 `by`** 가 `'alarm'` → 배달이 늦은 것(**②**) · `'boot'` → 알람이 없던 것(**④**).
 * 2회차 이후는 정상이면 늘 `'alarm'`.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - 실제로 어느 쪽인지. 판정은 **라이브 스탬프**만 한다.
 * - DO 런타임 동작(`LaneAlarm` 은 유닛에서 인스턴스화 불가) ⇒ **계약만** 고정한다.
 * - 조기 반환(킬스위치·일시정지·예산·유령 이름)은 표식을 안 지운다. 창(15초)이 그걸 덮지만,
 *   낡은 표식은 `'alarm'` 으로 읽혀 **④를 과소보고**한다 — 반대 방향으로 틀리는 쪽을 골랐다
 *   (없는 ④를 만들어 코드를 고치게 하는 것이 더 나쁘다). 이 비대칭은 의도다.
 */
describe('②④ 를 가르는 값 — 이 회차를 깨운 것', () => {
  it('부트스트랩이 되살릴 때 표식을 남긴다', () => {
    // `/start` 의 `kind !== 'alive'` 분기 안에서만 써야 한다 — 늘 쓰면 모든 회차가 'boot' 가 된다.
    const revive = code.slice(code.indexOf("if (kind !== 'alive')"))
    const body = revive.slice(0, revive.indexOf('return Response.json'))
    expect(body).toMatch(/\.put\(BOOT_KICK_KEY,\s*Date\.now\(\)\)/)
  })

  it('`alarm()` 이 그 표식을 읽고 **지운다** — 안 지우면 이후 회차가 전부 boot 로 오염된다', () => {
    expect(code).toMatch(/\.get<number>\(BOOT_KICK_KEY\)/)
    expect(code).toMatch(/\.delete\(BOOT_KICK_KEY\)/)
  })

  it('창으로 판정한다 — 낡은 표식이 영원히 boot 로 읽히지 않는다', () => {
    expect(code).toMatch(/const\s+BOOT_KICK_WINDOW_MS\s*=\s*[\d_]+/)
    const m = code.match(/const\s+BOOT_KICK_WINDOW_MS\s*=\s*([\d_]+)/)
    const ms = Number(String(m?.[1] ?? '').replace(/_/g, ''))
    expect(Number.isFinite(ms)).toBe(true)
    // 부트스트랩이 `now + 1s` 로 깨우므로 그보다 커야 하고, 1분 간격보다는 작아야 한다
    // (크면 정상 알람 회차까지 'boot' 로 삼킨다 = ④를 과대보고).
    expect(ms).toBeGreaterThan(1_000)
    expect(ms).toBeLessThan(60_000)
    expect(code).toMatch(/t0\s*-\s*Number\(bootKick\)\s*<\s*BOOT_KICK_WINDOW_MS/)
  })

  it('스탬프가 그 값을 싣는다 — 안 실으면 라이브에서 읽을 수 없다', () => {
    const stamp = code.slice(code.indexOf('serializeLaneStamp({'))
    expect(stamp.slice(0, 900)).toMatch(/by:\s*firedBy/)
  })

  it('반대 방향 — 되살리기(`setAlarm(now + 1s)`)를 빼지 않았다', () => {
    // 표식을 넣다가 이 줄을 지우면 부트스트랩이 체인을 못 세운다(표식만 쌓인다).
    expect(code).toMatch(/\.setAlarm\(Date\.now\(\)\s*\+\s*1_000\)/)
  })

  it('반대 방향 — `firedBy` 가 한쪽으로 굳지 않는다', () => {
    // 상수로 굳으면 매시 첫 회차 판정이 통째로 거짓이 된다(둘 다 같은 답을 낸다).
    expect(code).not.toMatch(/const\s+firedBy\s*=\s*'(boot|alarm)'/)
    expect(code).toMatch(/firedBy\s*=\s*bootKick\s*!=\s*null\s*&&/)
  })
})
