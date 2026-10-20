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
 * ② **균형** — 벽시계는 가장 큰 조각이 정한다. 그리고 조각의 비용은 주입 수가 아니라
 *    **vitest 호출 수**(주입 + 그 조각이 건드린 고유 테스트의 baseline)다. 그래서 같은 테스트를 쓰는
 *    주입을 한 조각에 모은다 — 실측으로 최대 조각 호출이 396 → 245(−38%)였다.
 * ②-2 **결정론** — 조각들은 서로를 못 보므로, 배분이 실행마다 바뀌면 "합치면 전수" 가 거짓이 된다.
 * ③ **용량** — 주입이 늘어 조각당 추정이 워크플로 상한을 먹기 시작하면 **빨간불로 알린다.**
 *    지금은 계획기가 자동으로 조각을 늘리므로 이 검사는 *계획기가 고장 났을 때*의 안전판이다.
 * ④ **배선** — 워크플로가 실제로 `--shard` 를 넘기고 행렬을 계획기에서 받아오는가.
 *    숫자를 손으로 적어 둔 행렬은 **낡는다**(이 워크플로의 주석이 실제로 2.5배 낡아 있었다).
 *
 * ## ❌ 이 시험이 **못 하는 것**
 * - 조각이 **실제로** 몇 분 걸리는지는 못 잰다(러너 성능·테스트 무게는 레포 밖 사실이다).
 *   그건 `SECONDS_PER_INJECTION` 이 실측과 벌어지는 것으로 드러나고, 그때 그 상수를 고친다.
 * - GitHub 이 행렬을 정말 만들어 주는지도 못 잰다 — 그건 첫 야간 실행이 판정한다.
 *
 * ## 🩸 이 러너를 손으로 죽일 때 (2026-10-01 에 실제로 당했다)
 * 러너는 소스를 망가뜨렸다 되돌린다. 복원은 `SIGINT`·`SIGTERM`·`exit` 에 걸려 있어 **튼튼하지만**:
 * - `kill -9` / `pkill -9` 는 **잡을 수 없는 신호**라 주입된 파일이 트리에 남는다.
 * - `pkill -f check-guard-mutations` 는 그 패턴이 **자기 셸의 명령줄에도 매치**돼 셸을 먼저 죽인다
 *   (실제로 exit 144 = SIGTERM 을 자기가 받았다). 그래서 대상은 멀쩡히 계속 돈다.
 * ⇒ `ps -eo pid,cmd | grep -F 'check-guard-mutations.mjs'` 로 **PID 를 집어** `kill <pid>`(TERM) 하고,
 *   그 뒤 `bash scripts/check-no-injection-in-progress.sh` 로 잔재 0 을 확인할 것.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  MAX_SHARDS, SECONDS_PER_INJECTION, TARGET_SHARD_MINUTES,
  assignShards, parseShard, planShards,
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
        // 테스트 파일이 여러 주입에 겹치는 실제 모양을 흉내 낸다(그게 그룹 배분이 다루는 입력이다).
        const items = Array.from({ length: count }, (_, i) => ({ name: `m${i}`, test: `t${i % 37}.test.ts` }))
        const got = assignShards(items, total)
        expect(got.length, `길이가 입력과 다르다 — count=${count} total=${total}`).toBe(count)
        const buckets = new Map<number, number[]>()
        got.forEach((k, i) => {
          expect(k, `조각 번호가 범위 밖 (${i}/${total})`).toBeGreaterThanOrEqual(0)
          expect(k, `조각 번호가 범위 밖 (${i}/${total})`).toBeLessThan(total)
          if (!buckets.has(k)) buckets.set(k, [])
          buckets.get(k)!.push(i)
        })
        const union = [...buckets.values()].flat()
        // 합집합이 전체와 같고(빠짐 0), 중복이 없다(겹침 0).
        expect(union.length, `합계가 전체와 다르다 — count=${count} total=${total}`).toBe(count)
        expect(new Set(union).size, `겹친 항목이 있다 — count=${count} total=${total}`).toBe(count)
      }
    }
  })

  it('①-2 같은 테스트 파일을 쓰는 주입은 **한 조각에 모인다** (baseline 중복 제거의 전부)', () => {
    // 🔑 러너는 테스트 파일별로 baseline 을 한 번 돈다. 흩뿌리면 그 baseline 이 조각마다 중복되고,
    //    실측에서 그게 최대 조각 vitest 호출의 38% 였다(396 → 245).
    for (const total of [2, 5, 12, 16]) {
      const items = Array.from({ length: 1000 }, (_, i) => ({ name: `m${i}`, test: `t${i % 53}.test.ts` }))
      const got = assignShards(items, total)
      const where = new Map<string, number>()
      items.forEach((m, i) => {
        if (!where.has(m.test)) where.set(m.test, got[i])
        expect(got[i], `테스트 ${m.test} 의 주입이 조각 ${where.get(m.test)} 와 ${got[i]} 로 갈렸다 (total=${total})`)
          .toBe(where.get(m.test))
      })
      // 그러므로 전체 vitest 호출 수 = 주입 수 + 고유 테스트 수 (한 덩어리로 돌 때와 **같다**).
      const perShard = Array.from({ length: total }, () => ({ n: 0, t: new Set<string>() }))
      items.forEach((m, i) => { perShard[got[i]].n += 1; perShard[got[i]].t.add(m.test) })
      const calls = perShard.reduce((a, s) => a + s.n + s.t.size, 0)
      expect(calls, `조각으로 가르면서 baseline 이 중복됐다 (total=${total})`).toBe(1000 + 53)
    }
  })

  it('② 균형 — 호출 수가 고르고, 주입 수 편차는 가장 큰 그룹 안에 묶인다', () => {
    for (const total of [2, 3, 4, 7, 16]) {
      for (const [count, mod] of [[1, 1], [5, 3], [100, 17], [2370, 519]] as const) {
        const items = Array.from({ length: count }, (_, i) => ({ name: `m${i}`, test: `t${i % mod}.test.ts` }))
        const got = assignShards(items, total)
        const sh = Array.from({ length: total }, () => ({ n: 0, t: new Set<string>() }))
        items.forEach((m, i) => { sh[got[i]].n += 1; sh[got[i]].t.add(m.test) })

        // 벽시계는 가장 큰 조각이 정한다 — 비용은 주입 수가 아니라 **vitest 호출 수**다.
        const calls = sh.map((s) => s.n + s.t.size)
        const ideal = (count + new Set(items.map((m) => m.test)).size) / total
        // 가장 큰 그룹(= 쪼갤 수 없는 최소 단위)만큼은 넘칠 수 있다 — LPT 의 성질이다.
        const biggest = Math.max(...[...new Set(items.map((m) => m.test))]
          .map((t) => items.filter((m) => m.test === t).length)) + 1
        expect(Math.max(...calls), `호출 불균형 — count=${count} mod=${mod} total=${total}`)
          .toBeLessThanOrEqual(Math.ceil(ideal) + biggest)

        // 주입 수도 가장 큰 그룹 범위 안에서 고르다(완전 균등은 **보장이 아니라 덤**이다).
        expect(Math.max(...sh.map((s) => s.n)) - Math.min(...sh.map((s) => s.n)),
          `주입 수 편차가 가장 큰 그룹보다 크다 — count=${count} mod=${mod} total=${total}`)
          .toBeLessThanOrEqual(biggest)
      }
    }
  })

  it('②-3 비용은 **vitest 호출 수**다 — baseline 을 안 세면 치우친 매니페스트에서 조각이 1.3배 무거워진다', () => {
    // 🔬 가르는 픽스처: [한 파일에 100건] + [각자 다른 파일 100건]. 주입 수만 세면 둘이 같아 보이지만
    //    호출 수는 101 대 200 이다. 그래서 baseline(`+1`)을 안 세면 solo 쪽 조각이 통째로 무거워진다.
    //    ⚠️ 오늘 레포 매니페스트에서는 `+1` 유무가 차이 0 이다(최대 호출 246 = 246) — 그래서 실측
    //    매니페스트로는 이 성질을 못 잰다. 이 픽스처가 그 눈먼 자리를 메운다(앞으로 새 가드마다
    //    테스트 파일이 하나씩 늘어 **solo 그룹 비중이 커지는 방향**이라 미리 묶어 둔다).
    const items = [
      ...Array.from({ length: 100 }, (_, i) => ({ name: `a${i}`, test: 'one.test.ts' })),
      ...Array.from({ length: 100 }, (_, i) => ({ name: `s${i}`, test: `solo${i}.test.ts` })),
    ]
    const got = assignShards(items, 2)
    const sh = [0, 1].map(() => ({ n: 0, t: new Set<string>() }))
    items.forEach((m, i) => { sh[got[i]].n += 1; sh[got[i]].t.add(m.test) })
    const calls = sh.map((x) => x.n + x.t.size)
    const ideal = (items.length + new Set(items.map((m) => m.test)).size) / 2   // 150.5
    // 실측: baseline 을 세면 151(비율 1.003) / 안 세면 200(비율 1.33).
    expect(Math.max(...calls) / ideal,
      `치우친 매니페스트에서 조각이 이상치의 ${(Math.max(...calls) / ideal).toFixed(2)}배다 — ` +
      '비용을 주입 수로만 세고 있을 가능성이 높다(그 조각의 baseline 이 안 세어졌다).')
      .toBeLessThan(1.1)
  })

  it('②-2 결정론 — 같은 매니페스트면 어느 조각에서 몇 번 돌려도 같은 배분', () => {
    // 🔴 조각들은 서로를 못 본다. 배분이 실행마다 바뀌면 "합치면 전수" 가 거짓이 된다.
    const items = Array.from({ length: 800 }, (_, i) => ({ name: `m${i}`, test: `t${(i * 7) % 61}.test.ts` }))
    const a = assignShards(items, 11)
    for (let round = 0; round < 3; round += 1) {
      expect(assignShards(items, 11), '같은 입력인데 배분이 달라졌다').toEqual(a)
    }
    // 테스트 경로가 없는 주입은 **홀로 선다**(한 그룹으로 뭉치면 그 조각만 비대해진다).
    const noTest = Array.from({ length: 60 }, (_, i) => ({ name: `n${i}` }))
    const k = assignShards(noTest, 6)
    const sizes = Array.from({ length: 6 }, (_, s) => k.filter((x) => x === s).length)
    expect(Math.max(...sizes) - Math.min(...sizes), '테스트 없는 주입이 한 조각으로 뭉쳤다').toBeLessThanOrEqual(1)
    // 잘못된 인자는 조용히 전수로 떨어지지 않고 던진다.
    expect(() => assignShards(items, 0)).toThrow()
    expect(() => assignShards(null as never, 4)).toThrow()
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

    // 부대비용 실측 ~0.6분(checkout·setup-node·npm ci) + 여유. 추정이 상한의 60% 를 넘으면 빨간불 — 처방까지 적어 둔다.
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
    // 🔑 테스트 파일 단위 그룹 배분을 **실제로** 쓰는가(색인 나머지로 되돌아가면 baseline 이 조각마다 중복된다).
    expect(src, '조각 선택이 그룹 배분을 쓰지 않는다').toMatch(/assignShards\(ALL, SHARD\.total\)/)
    expect(src, '색인 나머지 분배로 되돌아갔다').not.toMatch(/shardOf\(/)
    // 0건 조각은 실패여야 한다 — 그게 "조각 전부 초록인데 아무것도 안 돎" 을 막는다.
    expect(src, '0건 조각을 실패로 잡지 않는다').toMatch(/planned === 0[\s\S]{0,400}process\.exit\(1\)/)
    // --changed·--only 와 겹치면 초록이 무엇을 보증하는지 모호해진다.
    expect(src, '--shard 와 --changed/--only 겹침을 막지 않는다')
      .toMatch(/SHARD && \(CHANGED \|\| ONLY\)[\s\S]{0,300}process\.exit\(1\)/)
  })
})
