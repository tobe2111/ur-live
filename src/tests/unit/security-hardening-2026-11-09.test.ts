/**
 * 🔐 2026-11-09 보안 전수조사 — 대표 *"모두 다 순서대로 진행해줘"* 로 고친 것들의 불변식.
 *
 * 항목마다 describe 하나. 각 항목은 "가드 GREEN 인데 실제로는 뚫려 있던" 클래스라
 * 모양(인증 미들웨어가 붙어 있나)이 아니라 **동작**(그 검사가 실제로 거부하나)을 고정한다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 라이브 설정값(웹훅 IP 허용목록 등) — 코드가 아니라 Cloudflare 설정이다.
 * - 런타임 요청 흐름 전체 — 여기서는 핵심 판정 함수와 소스 모양만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '@/tests/helpers/source-text'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('① verifyPassword 결과는 객체다 — `.valid` 를 꺼내 판정한다', () => {
  // verifyPassword 는 { valid, isLegacy } 를 돌려준다. 객체 자체는 늘 참이라
  // `if (!result)` 로 판정하면 아무 PIN·비밀번호나 통과한다(2026-11-09 셀러 PIN 3곳 실측).
  const files = walk('src').map((p) => ({ p, code: readCode(p) }))

  it('측정 대상이 비어 있지 않다', () => {
    const callers = files.filter((f) => /await verifyPassword\(/.test(f.code))
    expect(callers.length, 'verifyPassword 호출 파일을 못 찾았다 — 검사가 헛돈다').toBeGreaterThan(8)
  })

  it('`const x = await verifyPassword(` 로 받은 값을 `!x` / `x` 로 판정하지 않는다', () => {
    const bad: string[] = []
    for (const { p, code } of files) {
      const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+verifyPassword\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(code))) {
        const name = m[1]
        const rest = code.slice(m.index + m[0].length, m.index + m[0].length + 400)
        const usesValid = new RegExp(`\\b${name}\\.valid\\b`).test(rest)
        if (!usesValid) bad.push(`${p}: ${name}`)
      }
    }
    expect(bad, '객체를 그대로 참/거짓으로 쓰면 검사가 늘 통과한다 — `{ valid }` 로 꺼낼 것').toEqual([])
  })

  it('셀러 PIN 검증은 `valid` 로 판정한다', () => {
    const code = readFileSync('src/features/seller/api/seller-pin.routes.ts', 'utf8')
    expect(code).toMatch(/const \{ valid: ok \} = await verifyPassword\(pin, pinHash\)/)
  })
})
