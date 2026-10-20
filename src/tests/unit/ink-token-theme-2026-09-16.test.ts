/**
 * 🖋️ 잉크 토큰이 테마를 따라간다 (2026-09-16 대표 신고 "글자들 개선해. 색깔이 뭐야 이게")
 *
 * ## 무엇이 터졌나 (대표 캡처 = 다크 `/partners`)
 * 장점 섹션의 제목 셋이 **배경에 잠겨 안 보였다.** 오타가 아니라 토큰 드리프트다:
 *
 * ```
 * bg-warm  = var(--bg)   → 다크 #11141C   ← 테마를 따라간다
 * text-ink = '#16181C'   → 다크에서도 그대로  ← 안 따라간다  ⇒ 대비 1.05 : 1
 * ```
 *
 * 2026-09-15 '색 정리' 가 `surface`·`line`·`warm`·`rule` 을 변수로 돌리면서 **잉크만 빼놓았다.**
 * 배경은 어두워지는데 글자는 안 밝아지니, 그 조합을 쓰는 화면은 통째로 안 읽힌다.
 *
 * ## 왜 아무도 몰랐나 — 가드 둘이 각자 정당한 이유로 비켜 갔다
 * · `check-theme-consistency` 는 **라이트 토큰**(`text-gray-900` 류)의 `dark:` 누락을 본다.
 *   `text-ink` 는 그 목록에 없다(변수를 가리키면 원래 `dark:` 가 필요 없으니 맞는 설계였다).
 * · `check-dark-contrast` 는 실제로 렌더해 재지만 **경로 목록이 곧 범위**이고 `/partners` 가 없었다.
 *   그리고 `text-ink` 를 쓰는 화면이 사실상 그 랜딩뿐이라, 다른 49개를 아무리 돌아도 안 잡힌다.
 *
 * ⇒ 그래서 여기서 **배선**을 고정한다. 실제 색은 `check-dark-contrast` 가 계속 잰다(경로 추가함).
 *
 * ## 이 시험이 **못** 보는 것
 * 렌더된 픽셀. `--ink` 가 다크에서 *충분히 밝은가* 는 여기서 판정하지 않는다(값 자체는 index.css 소관).
 * 이 파일이 막는 것은 딱 하나 — **다시 고정 hex 로 돌아가는 것**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = readFileSync('src/index.css', 'utf-8')
const TW = stripComments(readFileSync('tailwind.config.js', 'utf-8'))

/** tailwind 의 `ink: { … }` 블록 본문만 잘라낸다. */
function inkBlock(): string {
  const at = TW.search(/\bink:\s*\{/)
  expect(at, 'tailwind 에 `ink:` 스케일이 없다 — 이름이 바뀌었으면 이 시험도 함께 옮길 것').toBeGreaterThan(0)
  const open = TW.indexOf('{', at)
  const close = TW.indexOf('}', open)
  return TW.slice(open, close + 1)
}

describe('잉크 토큰이 CSS 변수를 가리킨다', () => {
  it.each([
    ['DEFAULT', '--ink'],
    ['soft', '--ink-soft'],
    ['faint', '--ink-faint'],
  ])('`ink.%s` 가 `var(%s)` 를 읽는다', (key, cssVar) => {
    expect(inkBlock(), `ink.${key} 가 고정 hex 로 돌아갔다 — 다크에서 글자가 배경에 잠긴다`)
      .toMatch(new RegExp(`\\b${key}:\\s*'var\\(${cssVar}\\)'`))
  })

  it('잉크 블록에 hex 리터럴이 하나도 없다 (값을 여기 다시 적으면 두 벌이 갈린다)', () => {
    expect(inkBlock(), '값의 SSOT 는 index.css 의 `--ink*` 하나다').not.toMatch(/#[0-9A-Fa-f]{3,8}/)
  })

  it('`--ink*` 의 라이트·다크 값이 실제로 갈려 있다 (안 갈리면 변수로 돌린 의미가 없다)', () => {
    for (const v of ['--ink', '--ink-soft', '--ink-faint']) {
      const hits = [...CSS.matchAll(new RegExp(`${v}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
      expect(hits.length, `${v} 선언을 못 찾았다`).toBeGreaterThanOrEqual(2)
      expect(new Set(hits).size, `${v} 가 한 값뿐이다 — 테마가 안 갈린다`).toBeGreaterThan(1)
    }
  })

  /**
   * 🔴 대시보드·늘 밝은 표면은 다크에서도 라이트 잉크여야 한다.
   *    이 되박기가 빠지면 `html.dark` 인 관리자 화면에서 흰 판 위에 흰 글자가 된다
   *    (CLAUDE.md "🚨 절대 규칙" — 대시보드는 항상 화이트).
   */
  it('라이트 고정 스코프가 `--ink*` 를 되박는다', () => {
    const at = CSS.indexOf('.light-island, .force-light-theme')
    expect(at, '라이트 고정 되박기 블록 셀렉터가 낡았다').toBeGreaterThan(0)
    const body = CSS.slice(CSS.indexOf('{', at), CSS.indexOf('\n}', CSS.indexOf('{', at)))
    for (const v of ['--ink:', '--ink-soft:', '--ink-faint:']) {
      expect(body, `${v} 되박기가 없다 — 다크 대시보드에서 글자가 사라진다`).toContain(v)
    }
  })
})

describe('다크 대비 가드가 입점 랜딩을 실제로 돈다', () => {
  const GUARD = readFileSync('scripts/check-dark-contrast.mjs', 'utf-8')

  /**
   * ⚠️ 문자열이 아니라 **경로 항목**으로 앵커한다 — 주석에 `/partners` 를 적어 두기만 해도
   *    통과하던 실수를 이 레포가 이미 여러 번 했다(`check-lock-table-symbols` 가 경고한 함정).
   */
  it('`/partners` 가 경로 목록에 모바일·PC 둘 다 있다', () => {
    const routes = [...stripComments(GUARD).matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1])
    expect(routes.filter((r) => r === '/partners').length,
      '입점 랜딩이 목록에서 빠지면 이 사고가 조용히 재발한다').toBeGreaterThanOrEqual(2)
  })
})
