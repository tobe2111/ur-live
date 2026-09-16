/**
 * 🚦 상태 색 토큰이 **세 스코프 모두**에 정의된다 (2026-09-03)
 *
 * ■ 왜 — 대시보드 상태 배지가 라이브에서 전부 같은 회색이었다
 *   `tailwind.config.js` 는 2026-06-19 지시("아예 흑백, 기능 빨강만 유지")로 장식 색조를
 *   잉크로 중화한다. 그런데 상태 배지가 하필 그 색조로 상태를 구분하고 있었다. 라이브 CSS 실측:
 *     `.bg-rose-50` == `.bg-emerald-50` == rgb(248 247 252)
 *     `.text-rose-700` == `.text-emerald-700` == rgb(61 60 58)
 *   반려와 승인이 픽셀 단위로 같았고, 에러가 안 나서 몇 달간 안 드러났다.
 *
 * ■ 이 테스트가 고정하는 것 — 토큰은 **세 곳**에 있어야 한다
 *   ① `:root` 라이트 값
 *   ② `.dark` 다크 값(어두운 바탕에서 읽히게 명도를 올린 것)
 *   ③ **always-light 래퍼 다섯 개**에서 라이트 값 되박기.
 *      ③이 빠지면 `html.dark` 인 사용자가 대시보드를 열 때 **흰 카드 위에 다크용 밝은 초록**이 뜬다
 *      (대시보드는 화이트 고정인데 `:root` 의 다크 토큰이 새어 들어온다).
 *      `--lift`/`--rule` 이 2026-09-02 에 정확히 같은 이유로 같은 자리에 들어갔다.
 *
 * ⚠️ 오늘 같은 검사를 한 번 헛돌게 짰다 — 스크롤바 규칙에서 `toContain('.dark .X ::-webkit-...')`
 *    가 **`:hover` 셀렉터 안에서** 매칭돼 통과했다. 그래서 여기서는 셀렉터 목록을 쪼개
 *    **정확한 멤버십**으로 본다.
 *
 * ⚠️ 못 잡는 것: 값이 실제로 대비를 만족하는지(그건 `check-dark-contrast` 가 렌더해서 잰다) ·
 *    어떤 상태에 어떤 tone 을 골랐는지(의미는 사람이 안다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf-8')
const TW = readFileSync(resolve(__dirname, '../../../tailwind.config.js'), 'utf-8')

const TONES = ['ok', 'warn', 'bad', 'info'] as const
/** always-light 래퍼 다섯 — `darkMode` variant 가 예외로 두는 그 집합과 같아야 한다. */
const ALWAYS_LIGHT = ['light-island', 'force-light-theme', 'admin-light-theme', 'seller-light-theme', 'agency-light-theme']

/** 선언 블록들을 셀렉터별로 쪼갠다(셀렉터 목록은 개별 셀렉터로 펼친다). */
function blocksFor(selector: string): string[] {
  const out: string[] = []
  const re = /(^|\n)([^{}\n][^{}]*)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(CSS))) {
    const sels = m[2].split(',').map((s) => s.trim())
    if (sels.some((s) => s === selector || s.startsWith(`${selector} `) || s.endsWith(selector))) out.push(m[3])
  }
  return out
}

describe('상태 색 토큰', () => {
  it('① tailwind 가 tone 을 MONO 중화 밖에 둔다', () => {
    // `pink: MONO, rose: MONO …` 로 중화되는 목록에 tone 이 섞이면 이 체계가 통째로 무의미해진다.
    expect(TW, 'colors.tone 이 없다').toMatch(/tone:\s*\{/)
    expect(TW, 'tone 이 MONO 로 중화됐다').not.toMatch(/tone:\s*MONO/)
    for (const t of TONES) {
      expect(TW, `tone.${t} 가 CSS 변수를 안 쓴다`).toContain(`var(--tone-${t})`)
      expect(TW, `tone.${t}.bg 가 없다`).toContain(`var(--tone-${t}-bg)`)
    }
  })

  it('② :root 에 라이트 값이 있다', () => {
    for (const t of TONES) {
      expect(CSS, `--tone-${t} 라이트 값 없음`).toMatch(new RegExp(`--tone-${t}:\\s*#`))
      expect(CSS, `--tone-${t}-bg 라이트 값 없음`).toMatch(new RegExp(`--tone-${t}-bg:\\s*#`))
    }
  })

  it('③ .dark 에 다크 값이 있다 — 어두운 바탕에서 읽히는 값', () => {
    const dark = blocksFor('.dark').join('\n')
    expect(dark.length, '.dark 블록을 못 찾았다 — 이 테스트가 헛돈다').toBeGreaterThan(0)
    for (const t of TONES) {
      expect(dark, `.dark 에 --tone-${t} 가 없다`).toContain(`--tone-${t}:`)
      expect(dark, `.dark 에 --tone-${t}-bg 가 없다`).toContain(`--tone-${t}-bg:`)
    }
  })

  it('④ always-light 래퍼 **다섯 개 모두** 라이트 값을 되박는다', () => {
    // 하나라도 빠지면 그 화면만 html.dark 에서 흰 카드 위에 다크용 밝은 색이 뜬다.
    for (const w of ALWAYS_LIGHT) {
      const blocks = blocksFor(`.${w}`).join('\n')
      expect(blocks.length, `.${w} 블록 자체를 못 찾았다`).toBeGreaterThan(0)
      for (const t of TONES) {
        expect(blocks, `.${w} 가 --tone-${t} 를 안 되박는다`).toContain(`--tone-${t}: #`)
      }
    }
  })

  it('⑤ 라이트와 다크 값이 서로 다르다 — 되박기가 의미 있으려면', () => {
    const dark = blocksFor('.dark').join('\n')
    for (const t of TONES) {
      const light = CSS.match(new RegExp(`--tone-${t}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
      const darkVal = dark.match(new RegExp(`--tone-${t}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
      expect(light, `--tone-${t} 라이트 값 파싱 실패`).toBeTruthy()
      expect(darkVal, `--tone-${t} 다크 값 파싱 실패`).toBeTruthy()
      expect(darkVal!.toLowerCase(), `--tone-${t} 가 라이트/다크 같은 값이다`).not.toBe(light!.toLowerCase())
    }
  })
})
