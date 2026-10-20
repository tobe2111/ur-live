/**
 * 🩸 테마 가드의 사각지대 3종 (2026-09-15 대표 지시 "3번만 하고 마무리하자")
 *
 * `check-theme-consistency` 는 **소비자 핵심 화면 143개를 통째로 안 보고 있었다.**
 * 대표가 반복해 신고한 *"글자가 안 보여"* 가 바로 그 검사의 관할인데, 그 화면들이 전부 면제였다.
 *
 * | 결함 | 무엇 | 증상 |
 * |---|---|---|
 * | **A** | 순수-다크 판정이 `dark:` 접두사를 안 봤다 | **다크 대응을 제대로 한 파일일수록 면제** — 150중 143 |
 * | **B** | 주석 판정이 줄 단위 | 여러 줄 JSX 주석의 **가운데 줄**을 코드로 오인(오탐 4건) |
 * | **C** | `light-island` 를 몰랐다 | 늘 밝아야 하는 표면(토스 위젯·지도 딜 카드)을 위반으로(오탐 3건) |
 *
 * A 가 제일 고약하다 — **옳게 쓸수록 검사를 안 받는다**. 이 레포가 반복해 당한
 * "가드가 실패할 수 없음" 의 변종이고, 여기선 "가드가 **보지도 않음**" 이었다.
 *
 * ## 이 시험이 **못** 막는 것
 * 드러난 위반을 옳게 고쳤는지는 안 본다(색 판단은 눈과 시안의 몫이다).
 * 여기서 고정하는 것은 **검사가 그 화면들을 실제로 본다** 하나뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const GUARD = 'scripts/check-theme-consistency.mjs'
const src = readFileSync(GUARD, 'utf-8')

/** 가드가 **실제로 쓰는** 순수-다크 판정 정규식을 소스에서 뽑는다(베껴 쓰면 드리프트한다). */
function skipRegex(): RegExp {
  const m = src.match(/if \((\/[^\n]*?\/)\.test\(src\)\) continue/)
  expect(m, '순수-다크 판정 정규식을 가드 소스에서 못 찾았다 — 이 시험이 낡았다').toBeTruthy()
  return new RegExp(m![1].slice(1, -1))
}

function consumerTsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!/(^|\/)(admin|seller|agency|wholesale|supplier|marketing)([-/]|$)/i.test(p)) consumerTsx(p, out); continue }
    if (e.name.endsWith('.tsx') && !/\/tests?\//.test(p)) out.push(p)
  }
  return out
}
const FILES = ['src/pages', 'src/components', 'src/features', 'src/shared'].flatMap((d) => consumerTsx(d))

describe('A — 다크 variant 를 쓴 파일이 검사에서 면제되지 않는다', () => {
  it('판정이 bare hex 만 본다 (dark: 접두사 구분)', () => {
    expect(src, [
      '`dark:bg-[#11141C]` 는 **올바른 다크 대응**이고, bare `bg-[#11141C]` 가 순수 다크 페이지다.',
      '구분하지 않으면 옳게 쓴 파일일수록 검사를 안 받는다(2026-09-15 실측 150중 143).',
    ].join('\n')).toMatch(/\(\?<!dark:\)bg-\\\[#11141C\\\]/)
  })

  it('실제로 면제되는 파일이 소수다 — 진짜 순수 다크 페이지만', () => {
    const re = skipRegex()
    const skipped = FILES.filter((f) => re.test(readFileSync(f, 'utf-8')))
    // 🛡️ 검사 성립: 파일을 실제로 모았는가(경로가 낡아 0건이면 이 시험이 무의미해진다)
    expect(FILES.length).toBeGreaterThan(300)
    expect(skipped.length, [
      `면제 파일이 ${skipped.length}개다 — 순수 다크 페이지가 그렇게 많을 리 없다.`,
      '판정이 `dark:` 접두사를 다시 놓치면 이 숫자가 140개대로 뛴다.',
      ...skipped.slice(0, 12),
    ].join('\n')).toBeLessThan(30)
  })
})

describe('B — 여러 줄 주석의 가운데 줄을 코드로 오인하지 않는다', () => {
  it('블록 주석 추적이 있고, **실제로 쓰인다**', () => {
    // 🩸 첫 판은 `toContain('inBlockComment')` 뿐이었다 — 계산만 남기고 **쓰는 줄**을 지우면 통과했다.
    //    주입 검증(`mutations/theme-guard-blindspots.mjs`)이 그걸 잡았다. 선언이 아니라 사용을 본다.
    expect(src, '블록 주석 추적을 계산만 하고 안 쓰면 아무것도 안 막는다')
      .toMatch(/if \(inBlockComment\[i\]\)\s*return/)
  })
  it('`{/*` 로 여는 JSX 주석도 주석으로 본다', () => {
    expect(src).toContain("trimmed.startsWith('{/*')")
  })
})

describe('C — 늘 밝은 표면(light-island)을 위반으로 보지 않는다', () => {
  it('`light-fixed` 와 같이 면제한다', () => {
    // `light-fixed` 는 **주석 부표**(런타임 무동작), `light-island` 는 **실제로 동작하는 클래스**다.
    expect(src).toMatch(/light-fixed'\)\s*\|\|\s*line\.includes\('light-island'\)/)
  })
})
