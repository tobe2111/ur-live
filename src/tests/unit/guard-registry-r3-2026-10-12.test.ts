/**
 * 가드 레지스트리 **R3** — 러너가 부르는 가드 파일이 실재하는가 (`scripts/check-guard-registry.mjs`)
 *
 * 🩸 2026-10-12 실측. `install-git-hooks.sh` 가 세 가드를 부르는데 셋 다 **2026-10-11 도매 철거로
 *   사라져 있었다**: `check-wholesale-autologin-guarded.mjs` · `check-wholesale-login-spa-navigate.mjs`
 *   · `check-login-gate-by-price.mjs`. `|| true` 로 감싸여 있어 **차단이 아니라 스택트레이스만** 찍히고
 *   그 불변식 셋은 조용히 없어졌다. R1(파일→러너)도 R2(가드→대상)도 **못 보는 방향**이라
 *   139개 전수 초록인 채 몇 달이 지났다.
 *
 * 🩸 그리고 **R3 의 첫 판이 같은 클래스에 빠졌다**: 러너 텍스트에 블록 주석 제거기를 썼더니
 *   셸·YAML·JS 를 **이어 붙인** 텍스트에서 한 파일의 `/*` 가 다른 파일의 `*​/` 와 짝지어
 *   **206,871자 → 54,215자(74% 증발)**, 찾아야 할 호출 셋이 그 안에 있어 **죽은 호출을 못 보고 초록**이
 *   떴다. 셸·YAML 엔 블록 주석이 없다 ⇒ **줄 주석만** 걷는다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 변수·글롭으로 부르는 가드(리터럴만 본다) · 러너 목록 자체가 낡는 것
 *   (`runnerText()` 가 새 러너 파일을 모르면 그 안의 호출은 R1·R3 둘 다에서 안 보인다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = 'scripts/check-guard-registry.mjs'
const ABS = resolve(process.cwd(), SCRIPT)
const src = readFileSync(SCRIPT, 'utf8')

/** 합성 레포에서 가드를 돌린다 — 실제 레포 상태와 무관하게 동작을 잰다. */
function runIn(runnerBody: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'guard-r3-'))
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{"scripts":{}}')
    writeFileSync(join(dir, 'scripts', 'check-alpha.mjs'), '// 아무것도 안 한다\n')
    writeFileSync(join(dir, 'scripts', 'audit-gate.sh'), runnerBody)
    try {
      const out = execFileSync('node', [ABS, '-s'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return { code: 0, out }
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string }
      return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('가드 레지스트리 R3 — 러너가 부르는 가드가 실재하는가', () => {
  it('① 없는 가드를 부르면 빨간불 (동작 판정)', () => {
    const r = runIn('node scripts/check-alpha.mjs\nnode scripts/check-ghost.mjs || true\n')
    expect(r.code).toBe(1)
    expect(r.out).toContain('scripts/check-ghost.mjs')
  })

  it('② 실재하는 가드만 부르면 초록 (①이 데이터 탓으로 헛돌지 않는다는 증거)', () => {
    const r = runIn('node scripts/check-alpha.mjs\n')
    expect(r.code).toBe(0)
  })

  it('③ 주석 처리된 호출은 호출이 아니다 (오탐 금지)', () => {
    const r = runIn('node scripts/check-alpha.mjs\n# node scripts/check-ghost.mjs  ← 폐기해서 지웠다\n')
    expect(r.code).toBe(0)
  })

  it('④ R3 은 블록 주석 제거기를 쓰지 않는다 (이어 붙인 텍스트에서 74% 증발)', () => {
    // 🔑 `stripComments(runners)` 로 되돌리면 ①이 다시 통과해 버린다 — 그 방향을 소스로 못 박는다.
    expect(src).not.toContain('stripComments(runners)')
    // 줄 주석만 걷는 필터가 R3 자리에 있는가
    expect(src).toMatch(/runners\s*\n\s*\.split\('\\n'\)\s*\n\s*\.filter\(\(l\) => !\/\^\\s\*\(#\|/)
  })

  it('⑤ 측정 대상이 0건이면 통과가 아니라 실패라고 스스로 선언한다', () => {
    expect(src).toContain('runnerText() 가 깨졌다')
  })

  it('⑥ 지금 레포에 죽은 가드 호출이 0건이다', () => {
    const out = execFileSync('node', [ABS, '-s'], { encoding: 'utf8' })
    expect(out).toContain('러너 호출 전부 실재')
  })
})
