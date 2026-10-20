/**
 * ⏰ 스케줄에 달아 놓은 cron 이 **실제로 발화하는 슬롯**에 있는지 고정한다. (2026-08-03 신설)
 *
 * ## 왜 — 배포는 초록불인데 라이브는 그대로였다
 *
 * 숙박 데모 72개가 **추첨 배지 없이** 89,000원짜리 진짜 숙박권으로 보이고 있었다. 자가치유
 * 백필을 `demo-fcfs-renew` 에 넣고 배포했는데 **라이브가 하나도 안 바뀌었다.**
 *
 * 그 cron 이 `if (cron === '0 * * * *')` 안에 있는데, 그 표현식은 `wrangler.toml` 의 crons 배열에
 * **없다**(3단계 보류 — 도매 예치금 자동 환불 규모 미측정이라 의도적으로 안 켰다).
 * 하트비트로 확인: 시간당 슬롯 32건이 **전부 `ads:*`**(별도 워커)이고 메인 워커 것은 **0건**.
 * 즉 그 블록은 한 번도 돈 적이 없고, 거기 든 20개가 함께 잠들어 있었다.
 *
 * **에러가 없다.** 그래서 배포·리뷰·기존 가드 어디에도 안 걸렸다.
 *
 * ## 이 테스트가 막는 것
 *
 * 소비자에게 보이는 데모 표시를 고치는 자가치유가 **다시 죽은 슬롯으로 돌아가는 것.**
 * (전수 래칫은 `scripts/check-cron-slot-registered.mjs` 가 본다 — 이 파일은 그중
 *  오늘 실제로 사고를 낸 한 건을 앵커로 고정한다.)
 *
 * ⚠️ **못 막는 것**: 슬롯이 등록돼 있어도 핸들러가 조기 return 하면 여전히 안 돈다(하트비트 몫).
 * 그리고 CF 대시보드에서 직접 건 cron 은 레포가 못 본다 — `wrangler.toml` 이 SSOT 라는 전제다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

/** wrangler.toml 의 `crons = [...]` — 주석(#)으로 죽여 둔 후보는 등록이 아니다. */
function registeredSlots(toml: string): string[] {
  const live = toml.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n')
  const m = live.match(/crons\s*=\s*\[([^\]]*)\]/)
  if (!m) return []
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1].trim())
}

/**
 * 어떤 `if (cron === 'X')` 블록이 이 safeCron 이름을 담고 있나 — 중괄호 깊이로 자른다.
 *
 * ⚠️ **가장 안쪽 블록을 답으로 삼는다.** 첫 판은 위에서부터 처음 만나는 블록을 돌려줬는데,
 *    그러면 살아 있는 블록 **안에 죽은 블록을 중첩**시키는 주입
 *    (`if (cron === '0 * * * *') { …demo-fcfs-renew… }` 을 `0 18` 안에 넣기)이
 *    바깥 `0 18` 로 판정돼 **초록**이 떴다(매니페스트 주입으로 실제 확인). 가장 좁은 범위가 실제 조건이다.
 */
function slotOf(src: string, cronName: string): string | null {
  const lines = src.split('\n')
  const hit = new RegExp(`safeCron\\(\\s*['"]${cronName}['"]`)
  let best: { slot: string; span: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/if\s*\(\s*cron\s*===\s*['"]([^'"]+)['"]\s*\)/)
    if (!m) continue
    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length
      if (j > i && depth <= 0) { end = j; break }
    }
    const body = lines.slice(i, end + 1)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))      // 주석은 배선이 아니다
      .join('\n')
    if (!hit.test(body)) continue
    const span = end - i
    if (!best || span < best.span) best = { slot: m[1], span }
  }
  return best?.slot ?? null
}

describe('데모 추첨 자가치유가 실제로 발화하는 슬롯에 있다', () => {
  const toml = read('wrangler.toml')
  const scheduled = read('src/worker/scheduled.ts')
  const slots = registeredSlots(toml)

  it('wrangler.toml 에서 crons 를 읽었다 (0개면 통과가 아니라 실패)', () => {
    expect(slots.length, 'crons 배열을 못 읽었다 — 형식이 바뀌었다').toBeGreaterThan(0)
  })

  /**
   * 🌆 2026-08-25: 일간 작업이 `scheduled.ts` → `cron/daily-lane.ts` 로 **이사**했다.
   *   그래서 "scheduled.ts 안에서 safeCron 이름을 찾는다"는 판정이 더는 성립하지 않는다 —
   *   그대로 두면 *배선이 멀쩡한데* 빨간불이고(오탐), 반대로 조건을 느슨하게 풀면 *배선이 빠져도*
   *   초록이 된다(미탐). ⇒ **한 단계 간접을 따라간다**: 작업 → 그룹 → 그 그룹을 띄우는 cron 블록.
   */
  function laneSlotOf(jobName: string): string | null {
    const lane = read('src/worker/cron/daily-lane.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    // 작업이 어느 그룹 블록 안에 있나 — 그룹 표식 사이 구간으로 자른다.
    const marks = [...lane.matchAll(/group === '([a-z]+)'|^\s*\/\/ growth$/gm)]
    let group: string | null = null
    const idx = lane.indexOf(`run('${jobName}'`)
    if (idx < 0) return null
    for (const m of marks) {
      if ((m.index ?? 0) < idx) group = m[1] ?? 'growth'
    }
    if (!group) group = 'growth'
    // 그 그룹을 띄우는 `if (cron === 'X' …) { runDailyLane('<group>' …`
    const re = new RegExp(`if \\(cron === '([^']+)'[^)]*\\)[^{]*\\{[^}]*runDailyLane\\('${group}'`, 's')
    return re.exec(scheduled)?.[1] ?? null
  }

  it('🔴 demo-fcfs-renew 가 등록된 슬롯에 배선돼 있다', () => {
    const slot = slotOf(scheduled, 'demo-fcfs-renew') ?? laneSlotOf('demo-fcfs-renew')
    expect(slot, 'scheduled.ts / daily-lane.ts 어디에서도 demo-fcfs-renew 배선을 못 찾았다').toBeTruthy()
    expect(slots, `슬롯 '${slot}' 은 wrangler.toml crons 에 없다 — 배포해도 한 번도 안 돈다`)
      .toContain(slot as string)
  })

  it('🔴 머니 작업도 등록된 슬롯에 있다 — 이사하면서 죽은 슬롯으로 가지 않았나', () => {
    for (const job of ['auto-settlement', 'supplier-settlement-mature', 'affiliate-mature']) {
      const slot = slotOf(scheduled, job) ?? laneSlotOf(job)
      expect(slot, `${job} 배선을 못 찾았다`).toBeTruthy()
      expect(slots, `${job} 의 슬롯 '${slot}' 이 wrangler.toml crons 에 없다 — 한 번도 안 돈다`)
        .toContain(slot as string)
    }
  })

  it('추첨 seed 가 그 cron 안에 실제로 있다 (연장만 하고 seed 는 빠지는 것 방지)', () => {
    const cron = read('src/worker/cron/demo-fcfs-renew.ts')
    expect(cron, '자가치유 seed 가 빠졌다').toContain('seedDemoRaffle')
  })
})
