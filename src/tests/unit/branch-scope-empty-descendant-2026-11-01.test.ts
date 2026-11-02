/**
 * 🧪 **0건의 원인 둘을 구분하는가** — `scripts/check-branch-scope.mjs` (2026-11-01).
 *
 * ## 무엇이 잘못돼 있었나
 * 그 가드는 `git diff --name-only origin/main...HEAD` 가 **0건**이고 HEAD≠base 면 무조건
 * *"base ref 가 낡았을 가능성이 크다"* 로 실패시켰다. 그런데 0건의 원인이 둘이다:
 *   ⓐ base 가 낡았다(= 비교 대상이 틀렸다 — 통과시키면 안 된다)
 *   ⓑ HEAD 가 base 의 **자손이고 내용 변화가 0** 이다(내용 없는 머지 커밋 · 빈 커밋)
 *
 * ⓑ 를 ⓐ 로 오진하면 처방도 틀린다 — 2026-11-01 에 `git fetch origin main` 을 하고 다시
 * 돌려도 같은 빨간불이었다(실측). **해결되지 않는 명령을 안내하는 거짓 빨간불**은 다음 세션을
 * `SKIP_PREPUSH_GATE=1` 로 밀어 게이트 자체를 무력화시킨다 — 그게 이 수리의 이유다.
 *
 * ## 왜 ⓑ 는 통과가 맞나
 * base 가 HEAD 의 조상이면 3점 diff 의 merge-base 가 곧 base 라 2점 diff 와 같다. 즉 0건은
 * **HEAD 의 트리가 base 의 트리와 같다**는 참값이고, 이 브랜치가 들여온 변경이 literally 0 이다.
 * 주입본이 숨을 자리가 구조적으로 없다(가드는 본래 *브랜치가 들여온 diff* 를 훑는다).
 *
 * ## 이 테스트가 지키는 것 — **양방향**
 * 완화는 "안 잡히게" 만들기가 쉽다. 그래서 넷을 같이 고정한다:
 *   ① HEAD == base → 통과(종전 동작)
 *   ② 자손 + 내용 0 → **통과**(이번 수리)
 *   ③ **갈라졌고** 내용 0 → **여전히 실패**(ⓐ 방향 — 이게 풀리면 눈먼 초록이 돌아온다)
 *   ④ 실제 변경이 있으면 종전처럼 훑는다 — 주입 지문이 있으면 실패
 * ②만 있으면 ③ 을 풀어 "고친" 척할 수 있고, ③만 있으면 ② 가 다시 막힌다.
 *
 * ## 못 막는 것
 * - 실제 CI 환경의 ref 상태(shallow clone 등)는 여기서 재현하지 않는다 — 그 경로는 스크립트가
 *   `base 브랜치를 못 찾아 … 건너뜁니다` 로 따로 빠진다.
 * - 중간 커밋이 주입을 넣고 뒤 커밋이 되돌린 경우. 그건 수리 전에도 못 봤다(가드는 **순-diff**
 *   스캐너다) — 그리고 코드에 남은 것이 0 이므로 막을 대상도 아니다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const GUARD = resolve(process.cwd(), 'scripts/check-branch-scope.mjs')

/** 합성 저장소에서 가드를 돌린다. `{ code, out }` — 종료코드가 판정이다. */
function runGuard(cwd: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [GUARD], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** `main` 브랜치 하나와 초기 커밋을 가진 저장소. 가드는 origin/main 이 없으면 main 으로 폴백한다. */
function newRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bscope-'))
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 't@example.com')
  git(dir, 'config', 'user.name', 'T')
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src/a.ts'), 'export const a = 1\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'init')
  return dir
}

const dirs: string[] = []
function repo(): string { const d = newRepo(); dirs.push(d); return d }
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

describe('branch-scope: 0건의 원인 구분', () => {
  it('🔒 ① HEAD == base 면 통과한다 — 종전 동작', () => {
    const d = repo()
    const r = runGuard(d)
    expect(r.code, r.out).toBe(0)
    expect(r.out).toMatch(/동일한 커밋/)
  })

  it('🔒 ② 자손 + 내용 변화 0 이면 통과한다 — 내용 없는 머지 커밋이 걸리던 자리', () => {
    const d = repo()
    // 내용이 이미 main 에 있는 브랜치를 머지한다 → 머지 커밋의 트리가 main 과 같다.
    git(d, 'checkout', '-q', '-b', 'side')
    git(d, 'checkout', '-q', 'main')
    git(d, 'checkout', '-q', '-b', 'work')
    git(d, 'commit', '-q', '--allow-empty', '-m', 'empty merge-ish')
    expect(git(d, 'diff', '--name-only', 'main...HEAD').trim()).toBe('')   // 전제: 3점 diff 가 비었다
    const r = runGuard(d)
    expect(r.code, r.out).toBe(0)
    expect(r.out).toMatch(/자손인데 내용 변화가 0/)
  })

  it('🔒 ③ 갈라졌고 내용 0 이면 **여전히 실패**한다 — 눈먼 초록 차단', () => {
    const d = repo()
    // main 과 work 가 각자 커밋을 갖되 둘 다 트리는 merge-base 와 같게 만든다.
    git(d, 'checkout', '-q', '-b', 'work')
    writeFileSync(join(d, 'src/h.ts'), 'export const h = 1\n'); git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'h+')
    git(d, 'rm', '-q', 'src/h.ts'); git(d, 'commit', '-q', '-m', 'h-')
    git(d, 'checkout', '-q', 'main')
    writeFileSync(join(d, 'src/b.ts'), 'export const b = 1\n'); git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'b+')
    git(d, 'rm', '-q', 'src/b.ts'); git(d, 'commit', '-q', '-m', 'b-')
    git(d, 'checkout', '-q', 'work')
    expect(git(d, 'diff', '--name-only', 'main...HEAD').trim()).toBe('')   // 전제: 3점 diff 가 비었다
    let ancestor = true
    try { git(d, 'merge-base', '--is-ancestor', 'main', 'HEAD') } catch { ancestor = false }
    expect(ancestor, '전제: main 이 HEAD 의 조상이 아니어야 한다').toBe(false)
    const r = runGuard(d)
    expect(r.code, r.out).toBe(1)
    expect(r.out).toMatch(/자손이 아니다/)
  })

  it('🔒 ④ 실제 변경이 있으면 종전처럼 훑는다 — 주입 지문은 그대로 잡힌다', () => {
    const d = repo()
    git(d, 'checkout', '-q', '-b', 'work')
    writeFileSync(join(d, 'src/a.ts'), 'export function f(p: number) {\n  if (false) {\n    return p\n  }\n  return p + 1\n}\n')
    git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'inject')
    const r = runGuard(d)
    expect(r.code, r.out).toBe(1)
    expect(r.out).toMatch(/주입 시그니처/)

    // 그리고 정상 변경은 통과해야 한다(지문을 넓혀 "고치는" 방향 차단).
    const d2 = repo()
    git(d2, 'checkout', '-q', '-b', 'work')
    writeFileSync(join(d2, 'src/a.ts'), 'export const a = 2\n')
    git(d2, 'add', '-A'); git(d2, 'commit', '-q', '-m', 'ok')
    const r2 = runGuard(d2)
    expect(r2.code, r2.out).toBe(0)
    expect(r2.out).toMatch(/주입 시그니처 없음/)
  })

  it('🔒 ⑤ 조상 판정이 소스에 실재한다 — 같은 결과를 다른 이유로 내는 것 차단', () => {
    // ②가 통과하는 이유가 "조상 판정" 이어야 한다. 조건을 통째로 지우고 늘 통과시켜도 ②는
    // 초록이 되므로(③ 만이 잡는다) 판정 자체의 존재를 함께 고정한다.
    const src = execFileSync('cat', [GUARD], { encoding: 'utf8' })
    expect(src).toMatch(/merge-base --is-ancestor/)
  })
})
