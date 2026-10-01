/**
 * 🧩 **전수 주입 검증의 조각 분할** — 벽시계가 타임아웃을 향해 기어오르는 것을 끊은 처방의 가드.
 *
 * ## 무엇을 막나 (2026-10-01 — 대표 지시 "타임아웃 문제도 영구적으로 해결해줘")
 * 야간 전수가 3주에 **42 → 77분**이 되어 `timeout-minutes: 90` 에 닿는 중이었다. 주입은
 * "새 가드를 만들면 주입 한 줄" 룰 때문에 구조적으로 계속 늘어나므로 상향은 벽을 미는 것뿐이다.
 * 처방은 조각 분할이고, 조각 수를 **사람이 적지 않고 세어서** 정한다.
 *
 * ## 이 시험이 실제로 지키는 것
 * ① **분배가 전수를 정확히 한 번 덮는다** — 조각 하나가 통째로 빠지면 "조각 전부 초록" 이
 *    아무것도 안 돈 것일 수 있다(이 레포가 반복해 당한 **조용한 부재**). 그래서 합집합·교집합을
 *    둘 다 센다.
 * ② **균형** — 벽시계는 가장 큰 조각이 정한다. 차이가 1 을 넘으면 분배가 깨진 것이다.
 * ③ **용량** — 주입이 늘어 조각당 추정이 워크플로 상한을 먹기 시작하면 **빨간불로 알린다.**
 *    지금은 계획기가 자동으로 조각을 늘리므로 이 검사는 *계획기가 고장 났을 때*의 안전판이다.
 * ④ **배선** — 워크플로가 실제로 `--shard` 를 넘기고 행렬을 계획기에서 받아오는가.
 *    숫자를 손으로 적어 둔 행렬은 **낡는다**(이 워크플로의 주석이 실제로 2.5배 낡아 있었다).
 *
 * ## ❌ 이 시험이 **못 하는 것**
 * - 조각이 **실제로** 몇 분 걸리는지는 못 잰다(러너 성능·테스트 무게는 레포 밖 사실이다).
 *   그건 `SECONDS_PER_INJECTION` 이 실측과 벌어지는 것으로 드러나고, 그때 그 상수를 고친다.
 * - GitHub 이 행렬을 정말 만들어 주는지도 못 잰다 — 그건 첫 야간 실행이 판정한다.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  MAX_SHARDS, SECONDS_PER_INJECTION, TARGET_SHARD_MINUTES,
  parseShard, planShards, shardOf,
} from '../../../scripts/guard-mutations-shard.mjs'

const ROOT = path.join(__dirname, '..', '..', '..')
const WF = path.join(ROOT, '.github/workflows/guard-mutations-full.yml')
const wf = () => fs.readFileSync(WF, 'utf8')

/** 지금 레포의 실제 주입 수. 러너에게 직접 물어본다(세는 규칙이 두 벌이 되지 않게). */
const actualCount = (): number => {
  const out = execFileSync('node', [path.join(ROOT, 'scripts/check-guard-mutations.mjs'), '--count'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 20,
  })
  return Number(out.trim())
}

describe('🧩 전수 주입 조각 분할', () => {
  it('① 분배가 전수를 정확히 한 번 덮는다 — 빠짐 0 · 겹침 0', () => {
    for (const total of [1, 2, 3, 4, 7, 13, 16]) {
      for (const count of [0, 1, 5, 100, 2370, 9999]) {
        const buckets = new Map<number, number[]>()
        for (let i = 0; i < count; i += 1) {
          const k = shardOf(i, total)
          expect(k, `조각 번호가 범위 밖 (${i}/${total})`).toBeGreaterThanOrEqual(0)
          expect(k, `조각 번호가 범위 밖 (${i}/${total})`).toBeLessThan(total)
          if (!buckets.has(k)) buckets.set(k, [])
          buckets.get(k)!.push(i)
        }
        const union = [...buckets.values()].flat()
        // 합집합이 전체와 같고(빠짐 0), 중복이 없다(겹침 0).
        expect(union.length, `합계가 전체와 다르다 — count=${count} total=${total}`).toBe(count)
        expect(new Set(union).size, `겹친 항목이 있다 — count=${count} total=${total}`).toBe(count)
      }
    }
  })

  it('② 균형 — 조각 크기 차이가 1 을 넘지 않는다 (벽시계는 가장 큰 조각이 정한다)', () => {
    for (const total of [2, 3, 4, 7, 16]) {
      for (const count of [1, 5, 100, 2370]) {
        const sizes = Array.from({ length: total }, () => 0)
        for (let i = 0; i < count; i += 1) sizes[shardOf(i, total)] += 1
        expect(Math.max(...sizes) - Math.min(...sizes), `불균형 — count=${count} total=${total}`)
          .toBeLessThanOrEqual(1)
      }
    }
  })

  it('③ 계획기가 조각당 목표 시간을 지킨다 — 그리고 상한을 넘지 않는다', () => {
    for (const count of [0, 1, 500, 2370, 5000]) {
      const { total, perShard, estMinutes } = planShards(count)
      expect(total).toBeGreaterThanOrEqual(1)
      expect(total).toBeLessThanOrEqual(MAX_SHARDS)
      expect(perShard * total, `조각 ${total}개 × ${perShard}건 이 전체 ${count}건을 못 덮는다`)
        .toBeGreaterThanOrEqual(count)
      // 상한에 닿지 않는 동안은 목표를 지켜야 한다(닿으면 목표를 넘는 것이 정상 — 그게 신호다).
      if (total < MAX_SHARDS) expect(estMinutes).toBeLessThanOrEqual(TARGET_SHARD_MINUTES + 0.001)
    }
    // 상한에 닿는 규모에서는 "목표 초과" 가 드러나야 한다 — 조용히 넘기면 그게 다음 사고다.
    const huge = planShards(MAX_SHARDS * TARGET_SHARD_MINUTES * 60 * 10 / SECONDS_PER_INJECTION)
    expect(huge.total).toBe(MAX_SHARDS)
    expect(huge.estMinutes).toBeGreaterThan(TARGET_SHARD_MINUTES)
  })

  it('④ 지금 레포의 실제 주입 수가 워크플로 상한 안에서 돈다 (계획기 고장 안전판)', () => {
    const count = actualCount()
    // 0건이면 통과가 아니라 실패다 — 세는 경로가 깨진 것이다.
    expect(count, '주입 수가 0 이다 — --count 가 깨졌다').toBeGreaterThan(500)

    const { total, estMinutes } = planShards(count)
    const m = /^\s*timeout-minutes:\s*(\d+)\s*$/m.exec(wf().split('jobs:')[1]?.split('full:')[1] ?? '')
    const cap = Number(m?.[1] ?? 0)
    expect(cap, '`full` 작업의 timeout-minutes 를 못 읽었다').toBeGreaterThan(0)

    // npm ci 실측 ~2분 + 여유. 추정이 상한의 60% 를 넘으면 빨간불 — 처방까지 적어 둔다.
    expect(
      estMinutes,
      `주입 ${count}건 → 조각 ${total}개 × 추정 ${estMinutes.toFixed(1)}분 이 상한 ${cap}분의 60% 를 넘었다.\n` +
        '   처방(이 순서로): ① `TARGET_SHARD_MINUTES` 를 낮춘다(조각이 저절로 늘어난다) ' +
        '② 그래도 MAX_SHARDS 에 닿으면 주입 자체의 비용을 본다. ' +
        '❌ timeout-minutes 를 올려 피하지 말 것 — 벽을 미는 것뿐이다.',
    ).toBeLessThanOrEqual(cap * 0.6)
  })

  it('⑤ `--shard k/n` 파싱 — 잘못된 값은 조용히 전수로 떨어지지 않고 던진다', () => {
    expect(parseShard(['-s'])).toBeNull()
    expect(parseShard(['--shard', '0/4'])).toEqual({ index: 0, total: 4 })
    expect(parseShard(['--shard=3/4'])).toEqual({ index: 3, total: 4 })
    // 🔴 범위를 벗어난 값이 전수로 떨어지면 CI 가 조각 하나를 전수로 돌아 타임아웃이 된다.
    expect(() => parseShard(['--shard', '4/4'])).toThrow()
    expect(() => parseShard(['--shard', '0/0'])).toThrow()
    expect(() => parseShard(['--shard', 'abc'])).toThrow()
    expect(() => parseShard(['--shard', '1'])).toThrow()
  })

  it('⑥ 배선 — 워크플로가 조각을 계획기에서 받아 `--shard` 로 넘긴다', () => {
    const s = wf()
    expect(s, '계획 작업이 주입 수를 세지 않는다').toMatch(/--count/)
    expect(s, '계획기를 부르지 않는다').toMatch(/guard-mutations-shard\.mjs --plan/)
    expect(s, '행렬을 계획 출력에서 받지 않는다').toMatch(/matrix:\s*\n\s*shard:\s*\$\{\{\s*fromJSON\(needs\.plan\.outputs\.matrix\)\s*\}\}/)
    expect(s, '러너에 --shard 를 넘기지 않는다').toMatch(/check-guard-mutations\.mjs -s --shard \$\{\{ matrix\.shard \}\}\/\$\{\{ needs\.plan\.outputs\.total \}\}/)
    // 한 조각이 깨져도 나머지를 끝까지 봐야 한다 — fail-fast 면 뒤가 통째로 안 돈다.
    expect(s, 'fail-fast: false 가 없다').toMatch(/fail-fast:\s*false/)
    // 🔴 전수의 존재 이유 — `--changed` 가 섞이면 전수가 전수가 아니게 된다.
    expect(s.includes('--changed'), '전수 워크플로에 --changed 가 섞였다')
      .toBe(s.includes('`--changed` 를 여기에 붙이지 말 것'))
    // 🔴 행렬을 손으로 적어 두면 그 숫자가 낡는다 — 이 워크플로가 이미 당한 사고다.
    expect(s, '행렬 숫자를 손으로 적어 뒀다').not.toMatch(/shard:\s*\[\s*\d/)
  })

  it('⑦ 러너가 조각을 가르고, 0건 조각과 플래그 겹침을 실패로 잡는다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/check-guard-mutations.mjs'), 'utf8')
    // 선택 자리에 조각 필터가 실제로 걸려 있는가(이름만 있고 안 걸면 전수로 돈다).
    expect(src, '루프에 조각 필터가 없다').toMatch(/if \(!inShard\(m\)\) continue/)
    expect(src, '조각 선택이 색인 분배를 쓰지 않는다').toMatch(/shardOf\(i, SHARD\.total\) === SHARD\.index/)
    // 0건 조각은 실패여야 한다 — 그게 "조각 전부 초록인데 아무것도 안 돎" 을 막는다.
    expect(src, '0건 조각을 실패로 잡지 않는다').toMatch(/planned === 0[\s\S]{0,400}process\.exit\(1\)/)
    // --changed·--only 와 겹치면 초록이 무엇을 보증하는지 모호해진다.
    expect(src, '--shard 와 --changed/--only 겹침을 막지 않는다')
      .toMatch(/SHARD && \(CHANGED \|\| ONLY\)[\s\S]{0,300}process\.exit\(1\)/)
  })
})
