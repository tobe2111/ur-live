/**
 * 🧬 주입 러너가 **조용히 다른 일을 하지 않게** — 두 가지 (2026-11-02)
 *
 * 대표 *"단발적으로 문제 해결하지 말고 교훈삼아서 근본적으로 해결할 수 있는게 있으면 해결해줘."*
 *
 * ① 모르는 인자 = 시작하지 않는다 (guard-mutations-args.mjs)
 *    `--only=X` 를 몰라 전수가 돈 사고(08-31) 뒤 그 인자 하나만 고쳤고, 11-02 에 형제 도구의 `--plan` 으로
 *    같은 일이 또 났다(끊자 소스에 주입이 남았다). 인자 하나씩이 아니라 **목록 밖 전부**를 막는다.
 * ② 글자까지 같은 주입 중복은 접는다 — 내용이 다른 같은 이름만 멈춘다 (foldDuplicateInjections)
 *    두 세션이 같은 2건을 다른 파일로 옮겨 main 의 모든 Verify 가 막혔다(11-02). 같은 고침이 두 번
 *    들어오는 것은 여러 세션이 도는 레포에서 정상이다.
 *
 * ⚠️ 못 보는 것: 러너 본문이 인자를 `process.argv` 로 *새로* 읽기 시작했는데 FLAGS 에 안 넣은 경우는
 *    ④ 가 소스에서 찾아 잡는다 — 단, `argv.includes('--x')` / `startsWith('--x=')` 모양만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FLAGS, VALUE_FLAGS, unknownArgs } from '../../../scripts/guard-mutations-args.mjs'
import { foldDuplicateInjections } from '../../../scripts/guard-mutations-manifest-diff.mjs'

const RUNNER = readFileSync('scripts/check-guard-mutations.mjs', 'utf8')

describe('① 모르는 인자 = 시작하지 않는다', () => {
  it('아는 인자는 통과한다', () => {
    expect(unknownArgs([])).toEqual([])
    expect(unknownArgs(['-s', '--changed'])).toEqual([])
    expect(unknownArgs(['--only', '🔦 옛 검색'])).toEqual([])
    expect(unknownArgs(['--only=🔦 옛 검색'])).toEqual([])
    expect(unknownArgs(['-s', '--shard', '3/16'])).toEqual([])
    expect(unknownArgs(['--shard=3/16'])).toEqual([])
  })

  it('모르는 인자 · 값 빠진 인자는 멈춘다 — 실제로 낸 사고 둘', () => {
    expect(unknownArgs(['--plan'])).toEqual(['--plan'])
    expect(unknownArgs(['--only'])).toHaveLength(1)
    expect(unknownArgs(['--only='])).toHaveLength(1)
    expect(unknownArgs(['--only', '--changed'])).toHaveLength(1)
    expect(unknownArgs(['--onyl=x'])).toEqual(['--onyl=x'])
  })

  it('러너가 판정을 실제로 부르고, 걸리면 exit 2 로 멈춘다(주입 전에)', () => {
    const at = RUNNER.indexOf('unknownArgs(process.argv.slice(2))')
    expect(at, '러너가 unknownArgs 를 안 부른다').toBeGreaterThan(0)
    expect(RUNNER.slice(at, at + 600)).toMatch(/process\.exit\(2\)/)
    expect(at, '인자 판정이 첫 주입보다 앞이어야 한다').toBeLessThan(RUNNER.indexOf('\nconst MUTATIONS = [\n'))
  })

  it('④ 러너가 읽는 인자는 전부 FLAGS/VALUE_FLAGS 에 있다', () => {
    const read = new Set<string>()
    for (const m of RUNNER.matchAll(/argv\.(?:includes|indexOf)\('(-{1,2}[a-z-]+)'\)/g)) read.add(m[1])
    for (const m of RUNNER.matchAll(/startsWith\('(--[a-z-]+)='\)/g)) read.add(m[1])
    expect(read.size, '러너에서 인자를 하나도 못 찾았다 — 이 시험의 정규식이 낡았다').toBeGreaterThan(5)
    const known = new Set([...FLAGS, ...VALUE_FLAGS])
    expect([...read].filter((a) => !known.has(a))).toEqual([])
  })
})

describe('② 같은 주입 중복', () => {
  const a = { name: 'x', file: 'f', find: 'a', replace: 'b', test: 't', why: '1' }
  it('글자까지 같으면 하나로 접는다(why 는 달라도 된다)', () => {
    const r = foldDuplicateInjections([a, { ...a, why: '2' }, { ...a, name: 'y' }])
    expect(r.list.map((m) => m.name)).toEqual(['x', 'y'])
    expect(r.identical).toEqual(['x'])
    expect(r.conflicts).toEqual([])
  })
  it('같은 이름에 내용이 다르면 conflicts — 러너는 멈춘다', () => {
    const r = foldDuplicateInjections([a, { ...a, find: 'other' }])
    expect(r.conflicts).toEqual(['x'])
    expect(RUNNER).toMatch(/if \(FOLDED\.conflicts\.length\) \{[\s\S]{0,300}process\.exit\(1\)/)
  })
  it('러너는 접은 목록으로 돈다', () => {
    expect(RUNNER).toMatch(/const ALL = FOLDED\.list\n/)
  })
})
