/**
 * GitHub 쪽 머지 사전검사 — `scripts/check-github-side-merge.mjs`
 *
 * 🩸 2026-10-06 실사고. PR 셋(#1621·#1623·#1625)이 멎어 있었다. 증상이 고약하다:
 *   PR 화면에 **빨간 체크가 하나도 없는데** `Verify` 가 아예 없었다(실패가 아니라 **부재**).
 *   원인:
 *
 *     .gitattributes:  docs/CURRENT_WORK.md merge=union
 *     로컬 git        → union 이 자동 해소          → "clean"
 *     GitHub 서버측   → .gitattributes 를 안 쓴다   → CONFLICT
 *
 *   그리고 GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 **디스패치되지 않는다**
 *   ⇒ Verify 부재 ⇒ auto-merge 조용히 멎음. 이 레포가 반복해 당한 '조용한 부재'.
 *
 * 🧭 그리고 **그 기제를 증명한 제 명령이 가짜였다**: `merge-tree --write-tree --attr-source=…` 는
 *   `error: unknown option` + **exit 129** 인데 `&& clean || CONFLICT` 로 읽어 "충돌" 로 보고했다.
 *   결론은 맞았지만 근거가 없었다. ⇒ 아래 ③·④ 가 그 혼동을 영구히 막는다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: GitHub 의 다른 머지 거부 사유(룰셋·서명) · main 이 그 뒤 움직이는 것
 *   (통과해도 다음 머지에 또 난다 — 이 레포는 세션이 여러 개 돌아 상시 움직인다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

const SCRIPT = 'scripts/check-github-side-merge.mjs'
const src = readFileSync(SCRIPT, 'utf8')
const gate = readFileSync('scripts/pre-push-gate.mjs', 'utf8')

describe('GitHub 쪽 머지 사전검사', () => {
  it('① 배선 — pre-push 게이트가 이 검사를 직접 부른다', () => {
    expect(gate).toContain("'scripts/check-github-side-merge.mjs'")
    // 가드보다 **앞**에서 돈다: CI 가 아예 안 도는 경우를 먼저 막는 것이 목적이다.
    expect(gate.indexOf('check-github-side-merge')).toBeLessThan(gate.indexOf('localGateSteps()'))
  })

  it('② 레지스트리가 pre-push 게이트를 러너로 인정한다 (안 그러면 이 검사가 "안 돈다"로 걸린다)', () => {
    // 🩸 처음엔 원문을 그대로 봤는데, 그 줄을 **주석 처리**한 주입이 통과했다
    //   (`// add('scripts/pre-push-gate.mjs')` 도 같은 문자열을 담는다). 주입 러너가 그걸 잡았다.
    //   ⇒ 주석을 걷고 본다(SSOT `stripComments` — 이 레포가 네 번 당한 자체 제거기 재작성 금지).
    const reg = stripComments(readFileSync('scripts/check-guard-registry.mjs', 'utf8'))
    expect(reg).toContain("add('scripts/pre-push-gate.mjs')")
    // ⚠️ local-ci-parity 는 **넣으면 안 된다** — EXCLUDE 의 이름들이 '등록됨' 으로 둔갑한다.
    expect(reg).not.toContain("add('scripts/local-ci-parity.mjs')")
  })

  it('③ `--attr-source` 는 최상위 git 옵션 자리에 있다 (merge-tree 하위로 주면 exit 129)', () => {
    // 인자 배열에서 `--attr-source` 가 'merge-tree' **앞**이어야 한다.
    const m = src.match(/tryGit\(\[([^\]]*attr-source[^\]]*)\]/)
    expect(m, 'attr-source 를 쓰는 tryGit 호출이 있어야 한다').toBeTruthy()
    const args = m![1]
    expect(args.indexOf('attr-source')).toBeLessThan(args.indexOf("'merge-tree'"))
  })

  it('④ 명령 실패와 충돌을 구분한다 (가짜 근거 재발 차단)', () => {
    expect(src).toMatch(/unknown option\|usage: git/)
  })

  it('⑤ 함정의 대상이 실재한다 — .gitattributes 에 커스텀 머지 규칙이 있다', () => {
    const attrs = readFileSync('.gitattributes', 'utf8')
    const rules = attrs
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .filter((l) => /\bmerge=/.test(l))
    // 0 이면 통과가 아니라 **이 검사가 헛도는 것**이다(지킬 대상이 없다).
    expect(rules.length).toBeGreaterThan(0)
    expect(attrs).toContain('docs/CURRENT_WORK.md merge=union')
  })

  // ── 행동 검증: 합성 레포로 그 함정을 실제로 만들어 본다(이력 커밋에 의존하지 않는다).
  const mkRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsm-'))
    const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
    writeFileSync(join(dir, '.gitattributes'), 'log.md merge=union\n')
    writeFileSync(join(dir, 'log.md'), 'base\n')
    g('add', '-A'); g('commit', '-qm', 'base')
    // main 과 feature 가 **같은 자리**에 서로 다른 줄을 붙인다 = 이 레포의 CURRENT_WORK.md 상황
    g('checkout', '-qb', 'feature')
    writeFileSync(join(dir, 'log.md'), 'feature 줄\nbase\n')
    g('commit', '-qam', 'feature')
    g('checkout', '-q', 'main')
    writeFileSync(join(dir, 'log.md'), 'main 줄\nbase\n')
    g('commit', '-qam', 'main')
    return { dir, g }
  }
  const runCheck = (dir: string, env: Record<string, string> = {}) => {
    try {
      const out = execFileSync('node', [join(process.cwd(), SCRIPT)], {
        cwd: dir, encoding: 'utf8', env: { ...process.env, GSM_BASE: 'main', GSM_HEAD: 'feature', ...env },
      })
      return { code: 0, out }
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string }
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
    }
  }

  it('⑥ 로컬만 clean 인 상황을 실제로 잡는다 (exit 1 + 파일 이름)', () => {
    const { dir, g } = mkRepo()
    try {
      // 전제 확인: 드라이버가 있으면 로컬은 clean 이다(= 사람 눈엔 문제가 없다).
      expect(() => g('merge-tree', '--write-tree', 'main', 'feature')).not.toThrow()
      const r = runCheck(dir)
      expect(r.code).toBe(1)
      expect(r.out).toContain('log.md')
      expect(r.out).toContain('merge=union')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('⑦ 해소하면 조용히 통과한다 (가짜 경보 0)', () => {
    const { dir, g } = mkRepo()
    try {
      g('checkout', '-q', 'feature'); g('merge', '--no-edit', '-q', 'main')
      const r = runCheck(dir)
      expect(r.code).toBe(0)
      expect(r.out).not.toContain('❌')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('⑧ 드라이버가 없으면 해당 없음으로 빠진다 (로컬도 충돌하므로 함정이 아니다)', () => {
    const { dir, g } = mkRepo()
    try {
      writeFileSync(join(dir, '.gitattributes'), '# 규칙 없음\n')
      g('commit', '-qam', 'drop attrs')
      const r = runCheck(dir)
      expect(r.code).toBe(0)
      expect(r.out).toContain('해당 없음')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('⑨ 우회가 있다 (GSM_SKIP=1)', () => {
    const { dir } = mkRepo()
    try {
      const r = runCheck(dir, { GSM_SKIP: '1' })
      expect(r.code).toBe(0)
      expect(r.out).toContain('건너뜀')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
