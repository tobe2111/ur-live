/**
 * 🛡️ **부모의 실패 기록이 자식의 성공 기록을 덮지 않는다** — 계약 (2026-08-01 14:00 실측 후 신설).
 *
 *   부모 기록은 설계상 *폴백*이라고 주석에 적혀 있었지만, 실제 SQL 은 `INSERT OR REPLACE` 였다 —
 *   즉 **무조건 덮어쓰기**. 14:00 틱 실측:
 *
 *   | 레인 | 자식 스탬프(= 일을 끝냈다) | 부모가 쓴 것 |
 *   |---|---|---|
 *   | `match-registry` | 14:01:05 | 14:01:10 `ok=false` |
 *   | `reclassify-company?passes=5` | 14:01:09 | 14:01:10 `ok=false` |
 *
 *   부모가 `await SELF.fetch` 응답을 못 받은 건 **부모가 죽었기 때문**이지 레인이 실패해서가 아니다.
 *   (같은 틱에서 레인 7개가 **같은 순간** 같은 벽 ms 10505~10663 에서 끊겼다 — 코드에 10초 타임아웃은
 *   없으니 밖에서 한 번에 죽인 것이다.) 그런데 화면에는 "이 레인 실패"로 남아, **멀쩡히 도는 수집기를
 *   고장으로 오진**하게 만든다. 오늘 실제로 그렇게 오진했다.
 *
 *   ⚠️ 이 시험이 **못 보는 것**: 실제 D1 이 `json_extract` 로 이 가드를 올바로 적용하는지는 라이브에서만
 *     확인된다(여기서는 발행되는 SQL 의 모양과 분기만 고정한다). SQLite JSON1 은 D1 기본 탑재다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
/**
 * 🔁 2026-08-01: 쓰기 본체가 `index.ts` → `beat-batch.ts` 로 옮겨졌다(그 모듈의 관심사이고,
 *   엔트리가 600줄 캡에 닿았다). **불변식은 그대로다** — 바뀐 것은 어느 파일을 보느냐뿐이다.
 */
const WRITER = readFileSync(resolve(process.cwd(), 'src/worker-ads/beat-batch.ts'), 'utf8')
const BLOCK = (() => {
  const i = WRITER.indexOf('export function makeBeatWriter(')
  expect(i, '쓰기 함수를 못 찾았다 — 이 시험이 헛돌고 있다').toBeGreaterThan(-1)
  return WRITER.slice(i)
})()

describe('부모 하트비트 쓰기 — 실패만 가드한다', () => {
  it('🔒 실패 쓰기는 **이번 틱에 이미 기록이 있으면 물러난다**', () => {
    expect(BLOCK, 'ON CONFLICT 가드가 없다 — 부모가 자식의 성공을 덮는다').toMatch(/ON CONFLICT\(key\) DO UPDATE SET value = \?2/)
    // COALESCE 로 감싸는 이유: 값이 JSON 이 아니거나 `at` 이 없으면 json_extract 는 NULL 이고,
    // SQL 에서 `NULL < ?` 는 참이 아니라 **NULL** 이라 조건이 통째로 거짓이 된다 → 부모가 영영 못 쓴다.
    expect(BLOCK, '틱 시작 시각과 비교하지 않으면 언제 쓴 기록인지 모른다')
      .toMatch(/COALESCE\(json_extract\(platform_settings\.value, '\$\.at'\), ''\) < \?3/)
  })

  it('🔒 성공 쓰기는 **무조건** — 자식이 기록을 못 남겼으면 부모의 성공 기록이 유일한 증거다', () => {
    expect(BLOCK).toMatch(/if \(b\.ok\) return env\.DB\.prepare\('INSERT OR REPLACE INTO platform_settings/)
  })

  it('🔒 틱 시작 시각을 **밖에서 주입**받는다 — flush 안에서 잡으면 자식 기록보다 나중이라 가드가 무력해진다', () => {
    expect(BLOCK, 'tickStartIso 를 인자로 받아야 한다').toMatch(/makeBeatWriter\(env: Env, tickStartIso: string\)/)
    expect(BLOCK, 'flush 안에서 시각을 새로 잡으면 안 된다').not.toMatch(/const tickStartIso = new Date/)
  })

  it('🔗 엔트리가 이 쓰기 함수를 실제로 쓴다 — 만들어 놓고 안 부르면 가드는 없는 것이다', () => {
    // 🔁 2026-08-02: 회차 시작 시각을 **변수로 뽑았다**(`tickStartIso`) — 하트비트 가드와 회차 이력이
    //   *같은 값*을 써야 해서다. **이 가드의 의도는 그대로다** — "엔트리가 이 쓰기 함수를 실제로 쓰는가".
    //   ⚠️ 인라인이든 변수든 **회차 시작 시각**이어야 한다(flush 시점을 넘기면 가드가 통째로 무력해진다 —
    //     `makeBeatWriter` 의 `tickStartIso` 주석 참조). 그래서 `new Date()` 를 *어딘가엔* 요구한다.
    expect(SRC).toMatch(/createBeatBatch\(makeBeatWriter\(env, (new Date\(\)\.toISOString\(\)|tickStartIso)\)\)/)
    expect(SRC, 'tickStartIso 는 회차 시작에 한 번 찍혀야 한다').toMatch(/const tickStartIso = new Date\(\)\.toISOString\(\)|makeBeatWriter\(env, new Date/)
    expect(SRC).toMatch(/import \{ createBeatBatch, makeBeatWriter \} from '\.\/beat-batch'/)
  })

  it('바인딩 3개가 다 들어간다(가드 SQL 은 ?1 ?2 ?3 을 쓴다)', () => {
    expect(BLOCK).toMatch(/\.bind\(key, value, tickStartIso\)/)
  })
})

describe('⏳ 배포 창 가드 — 정각 회차를 배포가 죽이지 않게', () => {
  const WF = readFileSync(resolve(process.cwd(), '.github/workflows/deploy-ads.yml'), 'utf8')

  it('배포 **전에** 대기 스텝이 있다 — 뒤에 두면 이미 죽인 다음이다', () => {
    const waitAt = WF.indexOf('정각 회차 보호')
    const deployAt = WF.indexOf('Build + Deploy ur-ads Worker')
    expect(waitAt, '대기 스텝이 없다').toBeGreaterThan(-1)
    expect(waitAt).toBeLessThan(deployAt)
  })

  it('🔒 무한 대기하지 않는다 — 배포가 영원히 안 나가면 그것도 고장이다', () => {
    const block = WF.slice(WF.indexOf('정각 회차 보호'), WF.indexOf('Build + Deploy ur-ads Worker'))
    expect(block).toMatch(/seq 1 12/)
    expect(block, '상한 도달 시 그냥 배포해야 한다').toMatch(/그대로 배포한다/)
  })

  it('창은 정각 **전후** 둘 다 — 뒤만 막으면 :58 배포가 :00 틱을 죽인다', () => {
    const block = WF.slice(WF.indexOf('정각 회차 보호'), WF.indexOf('Build + Deploy ur-ads Worker'))
    expect(block).toMatch(/-ge 57/)
    expect(block).toMatch(/-le 3/)
  })
})
