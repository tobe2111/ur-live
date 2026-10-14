/**
 * 🧹 손으로 쓴 CSS(src/index.css)에 **아무도 안 쓰는 클래스**가 쌓이지 않는다 (2026-10-14 대표 *"CSS 줄이기 …
 *    대기업급으로 최적화 및 로딩 속도 개선을 계속"*).
 *
 * 왜: 앱 CSS 는 **모든 화면의 첫 페인트를 막는다**(렌더 차단 + css-first 부팅이 JS 를 그 뒤에 세운다).
 *   Tailwind 유틸은 쓰는 것만 만들어지지만, index.css 의 손 규칙은 **지워진 화면의 것도 그대로 남는다.**
 *   실측(2026-10-14): 2,031줄 중 클래스 36종 · 규칙 49개 · keyframes 8개가 참조 0 — 라이브커머스(live-top-*, donation-*),
 *   도매(ws-cat-*, wholesale-light-theme), 옛 카드(ur-product-card*) 잔재였다. 지우니 28.77 → 27.76KB br.
 *
 * 고정하는 것: index.css 가 정의한 모든 클래스가 소스(src · index.html · tailwind 설정) 어딘가에 문자열로 존재한다.
 * ⚠️ 못 막는 것: 문자열은 남았는데 실제로 안 그려지는 클래스(죽은 분기·주석) · 동적으로 조립되는 이름
 *   (그런 이름을 새로 만들면 아래 ALLOW 에 사유와 함께 적는다 — 조립 방식이 소스에 남지 않아 이 검사가 못 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** 조립되는 이름 등 소스에 통째로 안 나타나는 정당한 클래스 — 사유 필수. */
const ALLOW: Record<string, string> = {
  'max-h-screen': 'Tailwind 기본 유틸을 index.css 에서 덮어쓴다(dvh 보정) — 소스는 Tailwind 이름으로 쓴다',
}

function classesIn(css: string): Set<string> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // 선택자 쪽만 — 선언 블록 안의 값(url(...a.b) 등)을 클래스로 오인하지 않게 블록을 지운다
  const selectorsOnly = noComments.replace(/\{[^{}]*\}/g, '{}')
  return new Set([...selectorsOnly.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
}

describe('index.css 에 죽은 클래스가 없다', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const src = execSync(
    "git ls-files -co --exclude-standard src index.html tailwind.config.js | grep -E '\\.(tsx?|jsx?|html|mjs)$|tailwind' | grep -v '^src/tests/' | grep -v '^src/index.css$'",
    { encoding: 'utf8' },
  ).trim().split('\n')
  const corpus = src.map((f) => { try { return readFileSync(f, 'utf8') } catch { return '' } }).join('\n')

  it('정의된 클래스를 실제로 센다(0이면 파서가 고장 — 통과가 아니다)', () => {
    expect(classesIn(css).size).toBeGreaterThan(50)
    expect(src.length).toBeGreaterThan(500)
  })
  it('모든 정의 클래스가 소스 어딘가에 있다', () => {
    const dead = [...classesIn(css)].filter((c) => !(c in ALLOW) && !corpus.includes(c))
    expect(dead, `아무도 안 쓰는 클래스 — index.css 에서 지울 것: ${dead.join(' ')}`).toEqual([])
  })
  it('ALLOW 항목은 실제로 정의돼 있다(낡은 예외 금지)', () => {
    for (const c of Object.keys(ALLOW)) expect(classesIn(css).has(c), c).toBe(true)
  })
})

describe('Tailwind 가 시험 파일로 유틸을 만들지 않는다', () => {
  const cfg = readFileSync('tailwind.config.js', 'utf8')
  it('content 가 src/tests 를 빼고, 워커(서버 첫 화면 HTML)는 빼지 않는다', () => {
    expect(cfg).toMatch(/"!\.\/src\/tests\/\*\*"/)
    expect(cfg).not.toMatch(/"!\.\/src\/worker/)
  })
})
