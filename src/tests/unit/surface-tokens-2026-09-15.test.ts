/**
 * 🎨 표면 토큰 채택 — 색을 손으로 박지 않는다 (2026-09-15 대표 "색 정리도 진행해줘")
 *
 * ## 무엇이 문제였나 (실측)
 * 소비자 화면 806파일에서 hex 색이 **2,875회 / 304종**. `src/index.css` 가 선언한 토큰은 **65개**다.
 * 그중 1,927회는 토큰과 **값이 같은데** hex 로 다시 적은 것이었다:
 * `#2C2F35`(682, `--line` 다크) · `#1D1F29`(604, `--surface` 다크) · `#11141C`(490, `--bg` 다크).
 * 화면마다 색이 조금씩 갈려 "AI 로 만든 것 같다"로 읽히던 정체가 이것이다.
 *
 * ## 무엇을 했나
 * `surface`/`line`/`warm` 을 고정 hex → **테마 변수**로 돌려 `bg-surface` 한 클래스가 두 테마를 덮게 했고,
 * **값이 한 글자도 안 바뀌는 짝만** 접었다(431곳). 나머지는 래칫으로 동결한다.
 *
 * ## 🔴 이 변경의 진짜 위험 — 대시보드가 다크에서 검게 뜬다
 * 대시보드는 **화이트 고정**이다(CLAUDE.md "🚨 절대 규칙"). `html.dark` 에서도 흰색이어야 하므로
 * `index.css` 의 라이트 고정 스코프가 테마 변수를 라이트 값으로 되박는다. 그런데 그 목록에
 * **`.seller-light-theme` 만 빠져 있었다** — 토큰이 고정 hex 이던 동안에는 변수를 안 읽어 안 터졌고,
 * 변수로 돌리는 순간 셀러 대시보드 배경이 `--bg`(다크 #11141C)를 읽게 된다. 같은 커밋에서 목록에 넣었다.
 *
 * ## 이 시험이 **못** 보는 것
 * 실제 렌더 색. 브라우저로는 따로 쟀고(다크에서 대시보드 4종 흰색 / 소비자만 다크 확인),
 * CI 의 `check-dark-contrast` 워크플로가 실제 렌더로 다시 잰다. 여기서는 **배선**만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = readFileSync('src/index.css', 'utf-8')
const TW = stripComments(readFileSync('tailwind.config.js', 'utf-8'))

/** `.light-island …` 되박기 블록 본문 */
function lightForcedBlock(): { selector: string; body: string } {
  const at = CSS.indexOf('.light-island, .force-light-theme')
  expect(at, '라이트 고정 되박기 블록을 못 찾았다 — 셀렉터가 낡았다').toBeGreaterThan(0)
  const open = CSS.indexOf('{', at)
  const close = CSS.indexOf('\n}', open)
  return { selector: CSS.slice(at, open), body: CSS.slice(open, close) }
}

describe('표면 토큰이 테마 변수를 가리킨다', () => {
  it.each([
    ['surface', '--surface'],
    ['line', '--line'],
    ['warm', '--bg'],
  ])('tailwind `%s` 가 `%s` 를 읽는다 (고정 hex 로 되돌아가지 않았다)', (token, cssVar) => {
    const re = new RegExp(`\\b${token}:\\s*'var\\(${cssVar}\\)'`)
    expect(TW, `${token} 이 고정 hex 로 돌아갔다 — 그러면 화면마다 다크 값을 손으로 적어야 한다`)
      .toMatch(re)
  })

  it('세 토큰의 라이트·다크 값이 실제로 갈려 있다 (안 갈리면 이 변경이 무의미)', () => {
    for (const v of ['--surface', '--line', '--bg']) {
      const hits = [...CSS.matchAll(new RegExp(`${v}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
      expect(hits.length, `${v} 선언을 못 찾았다`).toBeGreaterThanOrEqual(2)
      expect(new Set(hits).size, `${v} 가 한 값뿐이다 — 테마가 안 갈린다`).toBeGreaterThan(1)
    }
  })
})

describe('🔴 대시보드는 다크에서도 흰색이다 (절대 규칙)', () => {
  it('라이트 고정 목록에 네 스코프가 **전부** 있다 — seller 가 빠지면 셀러 대시보드가 검게 뜬다', () => {
    const { selector } = lightForcedBlock()
    for (const s of ['.light-island', '.force-light-theme', '.admin-light-theme', '.agency-light-theme', '.seller-light-theme']) {
      expect(selector, `되박기 목록에 ${s} 가 없다 — 그 스코프는 html.dark 에서 다크 값을 읽는다`).toContain(s)
    }
  })

  it('그 블록이 표면 세 토큰을 라이트 값으로 되박는다', () => {
    const { body } = lightForcedBlock()
    expect(body, '--bg 되박기가 없다').toMatch(/--bg:\s*#F8F7FC/i)
    expect(body, '--surface 되박기가 없다').toMatch(/--surface:\s*#FFFFFF/i)
    expect(body, '--line 되박기가 없다').toMatch(/--line:\s*#EAE4E0/i)
  })
})

describe('접은 짝은 값이 한 글자도 안 바뀐다', () => {
  it('토큰의 라이트 값이 접기 전 라이트 클래스와 같다', () => {
    // bg-white(#FFFFFF) → bg-surface · border-gray-200(INK.200) → border-line · bg-gray-50(INK.50) → bg-warm
    expect(TW, 'INK 스케일이 바뀌었다 — 접은 짝의 라이트 값이 달라진다').toMatch(/200:\s*'#EAE4E0'/)
    expect(TW, '〃').toMatch(/50:\s*'#F8F7FC'/)
    const { body } = lightForcedBlock()
    expect(body).toMatch(/--surface:\s*#FFFFFF/i)   // = bg-white
    expect(body).toMatch(/--line:\s*#EAE4E0/i)      // = gray-200
    expect(body).toMatch(/--bg:\s*#F8F7FC/i)        // = gray-50
  })

  it('접기 규칙(코드모드)이 안전한 짝만 담고 있다', () => {
    const mod = stripComments(readFileSync('scripts/codemods/adopt-surface-tokens.mjs', 'utf-8'))
    // 🔑 이 둘은 **절대 들어오면 안 된다** — 라이트 값이 토큰과 다르거나(gray-100=#F3EEEA),
    //    한 라이트 값에 다크 답이 둘이라(bg-white → #11141C 321곳 vs #1D1F29 168곳) 기계가 못 고른다.
    expect(mod, 'gray-100 을 --line 으로 접으면 화면이 바뀐다(#F3EEEA ≠ #EAE4E0)').not.toContain("'border-gray-100'")
    expect(mod, 'bg-white → dark #11141C 는 디자인 결정이다 — 기계가 고르면 안 된다')
      .not.toMatch(/'bg-white',\s*'dark:bg-\[#11141C\]'/)
  })
})

describe('래칫이 실제로 돈다', () => {
  it('audit-gate 와 CI 에 등록돼 있다 (파일만 있고 안 돌면 지키는 척이다)', () => {
    expect(readFileSync('scripts/audit-gate.sh', 'utf-8')).toContain('check-consumer-hex-ratchet.mjs')
    expect(readFileSync('.github/workflows/verify.yml', 'utf-8')).toContain('check-consumer-hex-ratchet.mjs')
  })

  it('동결값이 있고, 검사 대상 0건이면 통과가 아니도록 돼 있다', () => {
    const base = JSON.parse(readFileSync('scripts/consumer-hex-baseline.json', 'utf-8'))
    expect(base.total, '동결값이 비었다').toBeGreaterThan(500)
    const g = stripComments(readFileSync('scripts/check-consumer-hex-ratchet.mjs', 'utf-8'))
    expect(g, '대상 0건 방어가 없다 — 경로가 낡으면 조용히 통과한다').toMatch(/files\.length\s*<\s*\d+/)
  })
})
