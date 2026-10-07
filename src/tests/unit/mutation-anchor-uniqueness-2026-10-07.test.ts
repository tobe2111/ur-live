/**
 * 🎯 **주입 앵커는 유일해야 한다** — 그 판정이 pre-push 에서도 돌아야 한다 (2026-10-07)
 *
 * ## 왜 생겼나
 * 러너(`check-guard-mutations`)는 `find` 가 **두 곳 이상**에 맞으면 거부한다 —
 * *"주입 대상이 2곳 — 유일해야 한다(엉뚱한 곳을 고칠 수 있다)"*. 엉뚱한 곳을 고치면 그 주입은
 * **의도한 결함을 심지 않은 채** 결론을 낸다. 그런데 그 판정이 `--changed` 안에 있어서,
 * 범위 밖이면 PR 을 통과하고 **main 에서야** 터진다(2026-10-07 에 CI 한 바퀴를 태웠다:
 * wasm 폴백이 생겨 들여쓰기가 두 칸 줄어 앵커를 고쳤더니, 그 한 줄이 wasm 콜백의 같은 줄과
 * 글자까지 똑같아졌다).
 *
 * ⇒ 세는 일은 **공짜**이므로(파일을 이미 읽어 두었다) `check-stale-mutation-anchors` 가 함께 본다.
 * 그 가드는 전수 · 0초 · pre-push 에 이미 등록돼 있다.
 * 전수로 재니 **다른 곳에도 한 건**이 잠들어 있었다(`[이가]\s*없습니다` 가 자기 설명 주석에도
 * 그대로 적혀 있어 두 곳에 맞았다 — 주석을 고쳐 봐야 아무것도 검증하지 않는다).
 *
 * ## 이 시험이 하는 일
 * **합성 트리에 가드를 복사해 실제로 돌린다**(그 가드의 `ROOT` 는 자기 파일 위치에서 나온다).
 * 문자열 검사로는 "그 분기가 실제로 빨간불을 내는지" 를 알 수 없다 — 돌려 봐야 안다.
 *
 * ## ❌ 이 시험이 못 보는 것
 * 겹치는 매치(`aa` 안의 `a`)를 러너와 **똑같이** 세는지는 여기서 안 본다 — 둘 다 `i + 1` 로
 * 전진하지만, 러너가 규칙을 바꾸면 두 벌이 갈릴 수 있다(그 짝은 러너 쪽 시험의 몫이다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCode } from '../helpers/source-text'

const GUARD = 'scripts/check-stale-mutation-anchors.mjs'

/**
 * 합성 레포를 만든다. 가드엔 "주입 500건 미만이면 통과가 아니라 실패" 하한이 있으므로
 * (목록 경로가 낡아 조용히 0건이 되는 것을 막는 장치) 멀쩡한 주입을 넉넉히 채운다.
 */
function buildTree(extra: Array<{ find: string }>): string {
  const root = mkdtempSync(join(tmpdir(), 'anchor-uniq-'))
  mkdirSync(join(root, 'scripts', 'mutations'), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  copyFileSync(GUARD, join(root, 'scripts', 'check-stale-mutation-anchors.mjs'))
  // 러너는 인라인 배열만 읽힌다 — 비어 있어도 된다(형태만 맞으면).
  writeFileSync(join(root, 'scripts', 'check-guard-mutations.mjs'), 'const MUTATIONS = [\n]\n')

  // 🩸 첫 판은 `UNIQUE_ANCHOR_${i}` 였는데 `..._1` 이 `..._10` 의 **접두사**라 51건이 중복으로
  //   잡혔다(가드가 아니라 **내 픽스처**가 틀렸다 — 측정값이 이상하면 측정기를 먼저 의심할 것).
  //   자리수를 고정하고 종결자를 붙여 어느 것도 다른 것의 부분문자열이 되지 않게 한다.
  const benign = Array.from({ length: 520 }, (_, i) => ({
    find: `UNIQUE_ANCHOR_${String(i).padStart(4, '0')}_END`,
  }))
  const all = [...benign, ...extra]
  writeFileSync(join(root, 'src', 'fixture.ts'), all.map((m) => `// ${m.find}`).join('\n') + '\n')
  writeFileSync(
    join(root, 'scripts', 'mutations', 'fixture.mjs'),
    `export default ${JSON.stringify(
      all.map((m, i) => ({ name: `n${i}`, file: 'src/fixture.ts', find: m.find, replace: 'X', test: 't', why: 'w' })),
    )}\n`,
  )
  return root
}

function run(root: string): { code: number; out: string } {
  try {
    const out = execFileSync('node', [join(root, 'scripts', 'check-stale-mutation-anchors.mjs')], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('주입 앵커 유일성 (2026-10-07)', () => {
  it('① 유일한 앵커만 있으면 통과한다 (측정기 자기검사)', () => {
    const r = run(buildTree([]))
    expect(r.out).toContain('앵커 전부 소스에 실재')
    expect(r.code).toBe(0)
  })

  it('🔴 ② 같은 앵커가 두 곳에 맞으면 빨간불이다 (이 수리의 본체)', () => {
    // 같은 문자열을 픽스처에 두 번 쓰게 만든다 — 주석 줄 + 코드 줄이 겹치는 실제 모양이다.
    const root = buildTree([{ find: 'TWICE_HERE' }, { find: 'TWICE_HERE' }])
    const r = run(root)
    expect(r.code).toBe(1)
    expect(r.out).toContain('두 곳 이상')
  })

  it('🔴 ③ 앵커가 아예 없으면 여전히 빨간불이다 (종전 기능 보존)', () => {
    const root = buildTree([])
    // 픽스처에 없는 앵커를 매니페스트에만 추가한다.
    const manifest = join(root, 'scripts', 'mutations', 'gone.mjs')
    writeFileSync(manifest, `export default [{ name: 'gone', file: 'src/fixture.ts', find: 'NOT_IN_SOURCE', replace: 'X', test: 't', why: 'w' }]\n`)
    const r = run(root)
    expect(r.code).toBe(1)
    expect(r.out).toContain('소스에 없다')
  })

  it('④ 유일성 판정이 가드에 배선돼 있다 (합성 통과가 우연이 아님을 고정)', () => {
    const src = readCode(GUARD)
    expect(src).toMatch(/hits > 1/)
    expect(src).toMatch(/유일해야 한다/)
  })
})
